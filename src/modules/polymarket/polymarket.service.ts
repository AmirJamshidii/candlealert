import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { IWinner } from '../telegram/telegram-message.factory';
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

@Injectable()
export class PolymarketService {
  private readonly logger = new Logger(PolymarketService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly errorLogService: ErrorLogService,
  ) {}

  async handleSignal(
    signalKey: string,
    interval: string,
    openTime: number,
    closeTime: number,
  ): Promise<IWinner[]> {
    try {
      const { conditionId, question } = await this.findMarket(interval, openTime);
      if (!conditionId) {
        this.logger.warn(`No Polymarket market found for btc-updown-${interval}-${Math.floor(openTime / 1000)}`);
        return [];
      }

      return await this.getTopDownHolders(conditionId, question, signalKey, interval, closeTime);
    } catch (err) {
      this.errorLogService.log(err, { module: 'polymarket' });
      return [];
    }
  }

  private async findMarket(interval: string, openTime: number): Promise<{ conditionId: string; question: string }> {
    const slug = `btc-updown-${interval}-${Math.floor(openTime / 1000)}`;
    this.logger.log(`Fetching Polymarket market: ${slug}`);

    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.appConfig.polymarketGammaUrl}/events`, {
          params: { slug },
          timeout: 10_000,
        }),
      );

      const events: Array<{ markets?: Array<{ conditionId: string; question: string }> }> =
        Array.isArray(res.data) ? res.data : [res.data];

      const market = events[0]?.markets?.[0];
      if (!market?.conditionId) return { conditionId: '', question: '' };

      this.logger.log(`conditionId: ${market.conditionId}`);
      return { conditionId: market.conditionId, question: market.question ?? slug };
    } catch (err) {
      this.logger.error('Failed to fetch Polymarket event', err);
      return { conditionId: '', question: '' };
    }
  }

  private async getTopDownHolders(
    conditionId: string,
    marketQuestion: string,
    signalKey: string,
    interval: string,
    closeTime: number,
  ): Promise<IWinner[]> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.appConfig.polymarketDataUrl}/holders`, {
          params: { market: conditionId, limit: 500 },
          timeout: 15_000,
        }),
      );

      const groups: PolymarketTokenGroup[] = Array.isArray(res.data) ? res.data : [];

      // Find the Down token group (outcomeIndex === 1)
      const downGroup = groups.find((g) => g.holders?.[0]?.outcomeIndex === 1);
      if (!downGroup?.holders?.length) {
        this.logger.warn(`No Down holders found for market ${conditionId}`);
        return [];
      }

      const top = downGroup.holders.slice(0, this.appConfig.polymarketWinnerCount);
      this.logger.log(`Top Down holders fetched: ${top.length}`);

      // Store in DB
      await this.winnerRepo.saveAll(
        top.map((h) => ({
          signalKey,
          marketId: conditionId,
          marketQuestion,
          walletAddress: h.proxyWallet,
          positionSize: String(h.amount),
          outcomeSide: 'Down',
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
      this.logger.error('Failed to fetch Polymarket holders', err);
      return [];
    }
  }
}
