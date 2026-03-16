import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { IWinner, IPosition } from '../telegram/telegram-message.factory';
import { ReversalDirection } from '../../events/reversal-signal.event';
import { ErrorLogService } from '../error-log/error-log.service';

interface PolymarketHolder {
  proxyWallet: string;
  name: string;
  pseudonym: string;
  amount: number;
  outcomeIndex: number;
}

interface PolymarketTokenGroup {
  token: string;
  holders: PolymarketHolder[];
}

interface PolymarketPosition {
  proxyWallet: string;
  name?: string;
  avgPrice: number;
  totalPnl: number;
  outcomeIndex: number;
}

interface PolymarketPositionGroup {
  token: string;
  positions: PolymarketPosition[];
}

@Injectable()
export class PolymarketService {
  private readonly logger = new Logger(PolymarketService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly errorLogService: ErrorLogService,
  ) { }

  async handleSignal(
    signalKey: string,
    interval: string,
    openTime: number,
    closeTime: number,
    direction: ReversalDirection = 'green_to_red',
  ): Promise<{ holders: IWinner[]; positions: IPosition[] }> {
    try {
      const { conditionId, question } = await this.findMarket(interval, openTime);
      if (!conditionId) {
        this.logger.warn(`No Polymarket market found for btc-updown-${interval}-${Math.floor(openTime / 1000)}`);
        return { holders: [], positions: [] };
      }

      // outcomeIndex: 1 = Down (green→red), 0 = Up (red→green)
      const outcomeIndex = direction === 'green_to_red' ? 1 : 0;
      const outcomeSide = direction === 'green_to_red' ? 'Down' : 'Up';

      const [holders, positions] = await Promise.all([
        this.getTopHolders(conditionId, question, signalKey, interval, closeTime, outcomeIndex, outcomeSide),
        this.getTopPositionsByPnl(conditionId, question, outcomeIndex),
      ]);
      return { holders, positions };
    } catch (err) {
      this.errorLogService.log(err, { module: 'polymarket' });
      return { holders: [], positions: [] };
    }
  }

  private async findMarket(interval: string, openTime: number): Promise<{ conditionId: string; question: string }> {
    const slug = `btc-updown-${interval}-${Math.floor(openTime / 1000)}`;
    this.logger.log(`Fetching Polymarket market: ${slug}`);

    const url = `${this.appConfig.polymarketGammaUrl}/events`;
    this.logger.log(`[API] GET ${url} | params: ${JSON.stringify({ slug })}`);
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, {
          params: { slug },
          timeout: 10_000,
        }),
      );
      this.logger.log(`[API] GET ${url} → status=${res.status} | events=${Array.isArray(res.data) ? res.data.length : 1}`);

      const events: Array<{ markets?: Array<{ conditionId: string; question: string }> }> =
        Array.isArray(res.data) ? res.data : [res.data];

      const market = events[0]?.markets?.[0];
      if (!market?.conditionId) return { conditionId: '', question: '' };

      this.logger.log(`conditionId: ${market.conditionId}`);
      return { conditionId: market.conditionId, question: market.question ?? slug };
    } catch (err) {
      this.logger.error(`[API] GET ${url} → FAILED`, err);
      return { conditionId: '', question: '' };
    }
  }

  private async getTopHolders(
    conditionId: string,
    marketQuestion: string,
    signalKey: string,
    interval: string,
    closeTime: number,
    outcomeIndex: number,
    outcomeSide: string,
  ): Promise<IWinner[]> {
    const holdersUrl = `${this.appConfig.polymarketDataUrl}/holders`;
    this.logger.log(`[API] GET ${holdersUrl} | params: ${JSON.stringify({ market: conditionId, limit: 500 })}`);
    try {
      const res = await firstValueFrom(
        this.httpService.get(holdersUrl, {
          params: { market: conditionId, limit: 500 },
          timeout: 15_000,
        }),
      );
      this.logger.log(`[API] GET ${holdersUrl} → status=${res.status} | groups=${Array.isArray(res.data) ? res.data.length : 0}`);

      const groups: PolymarketTokenGroup[] = Array.isArray(res.data) ? res.data : [];

      const group = groups.find((g) => g.holders?.[0]?.outcomeIndex === outcomeIndex);
      if (!group?.holders?.length) {
        this.logger.warn(`No ${outcomeSide} holders found for market ${conditionId}`);
        return [];
      }

      const top = group.holders.slice(0, this.appConfig.polymarketWinnerCount);
      this.logger.log(`Top ${outcomeSide} holders fetched: ${top.length} (of ${group.holders.length} total)`);

      // Store in DB
      await this.winnerRepo.saveAll(
        top.map((h) => ({
          signalKey,
          marketId: conditionId,
          marketQuestion,
          walletAddress: h.proxyWallet,
          positionSize: String(h.amount),
          outcomeSide,
          candleInterval: interval,
          candleCloseTime: String(closeTime),
        })),
      );

      return top.map((h) => ({
        walletAddress: h.proxyWallet,
        positionSize: h.amount,
        marketQuestion,
        name: h.name || h.pseudonym || undefined,
      }));
    } catch (err) {
      this.logger.error(`[API] GET ${holdersUrl} → FAILED`, err);
      return [];
    }
  }

  private async getTopPositionsByPnl(conditionId: string, marketQuestion: string, outcomeIndex: number): Promise<IPosition[]> {
    const side = outcomeIndex === 1 ? 'Down' : 'Up';
    const positionsUrl = `${this.appConfig.polymarketDataUrl}/v1/market-positions`;
    const positionsParams = { market: conditionId, limit: 500, sortBy: 'TOTAL_PNL', sortDirection: 'DESC' };
    this.logger.log(`[API] GET ${positionsUrl} | params: ${JSON.stringify(positionsParams)}`);
    try {
      const res = await firstValueFrom(
        this.httpService.get(positionsUrl, {
          params: positionsParams,
          timeout: 15_000,
        }),
      );
      this.logger.log(`[API] GET ${positionsUrl} → status=${res.status} | groups=${Array.isArray(res.data) ? res.data.length : 0}`);

      const groups: PolymarketPositionGroup[] = Array.isArray(res.data) ? res.data : [];

      const group = groups.find((g) => g.positions?.[0]?.outcomeIndex === outcomeIndex);
      if (!group?.positions?.length) {
        this.logger.warn(`No ${side} positions found for market ${conditionId}`);
        return [];
      }

      const top = group.positions
        .filter((p) => p.totalPnl > 0)
        .slice(0, this.appConfig.polymarketWinnerCount);

      this.logger.log(`Top ${side} positions by PNL fetched: ${top.length} (of ${group.positions.length} total, filtered positive PNL)`);

      return top.map((p) => ({
        walletAddress: p.proxyWallet,
        name: p.name || undefined,
        avgPrice: p.avgPrice,
        totalPnl: p.totalPnl,
        marketQuestion,
      }));
    } catch (err) {
      this.logger.error(`[API] GET ${positionsUrl} → FAILED`, err);
      return [];
    }
  }
}
