import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { WalletProfileRepository } from './wallet-profile.repository';
import { IWinner, IPosition } from '../telegram/telegram-message.factory';
import { ReversalDirection } from '../../events/reversal-signal.event';
import { ErrorLogService } from '../error-log/error-log.service';
import {
  evalNewWallet,
  evalBuyOnly,
  evalPositionValue,
  evalConviction,
  computeSuspectScore,
} from './suspect-scoring';

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

interface PolymarketUserPosition {
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  realizedPnl: number;
  cashPnl: number;
  eventSlug: string;
}

interface PolymarketPublicProfile {
  proxyWallet: string;
  createdAt: string | null;
  name: string | null;
  pseudonym: string | null;
}

@Injectable()
export class PolymarketService {
  private readonly logger = new Logger(PolymarketService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly walletProfileRepo: WalletProfileRepository,
    private readonly errorLogService: ErrorLogService,
  ) {}

  async handleSignal(
    signalKey: string,
    interval: string,
    openTime: number,
    closeTime: number,
    direction: ReversalDirection = 'green_to_red',
  ): Promise<{ holders: IWinner[]; positions: IPosition[] }> {
    try {
      const { conditionId, question } = await this.findMarket(
        interval,
        openTime,
      );
      if (!conditionId) {
        this.logger.warn(
          `No Polymarket market found for btc-updown-${interval}-${Math.floor(openTime / 1000)}`,
        );
        return { holders: [], positions: [] };
      }

      // outcomeIndex: 1 = Down (green→red), 0 = Up (red→green)
      const outcomeIndex = direction === 'green_to_red' ? 1 : 0;
      const outcomeSide = direction === 'green_to_red' ? 'Down' : 'Up';

      const [holders, positions] = await Promise.all([
        this.getTopHolders(
          conditionId,
          question,
          signalKey,
          interval,
          closeTime,
          outcomeIndex,
          outcomeSide,
        ),
        this.getTopPositionsByPnl(conditionId, question, outcomeIndex),
      ]);

      return { holders, positions };
    } catch (err) {
      this.errorLogService.log(err, { module: 'polymarket' });
      return { holders: [], positions: [] };
    }
  }

  async isMarketClosed(interval: string, openTime: number): Promise<boolean> {
    try {
      const { closed } = await this.findMarket(interval, openTime);
      return closed;
    } catch {
      return false;
    }
  }

  private async findMarket(
    interval: string,
    openTime: number,
  ): Promise<{ conditionId: string; question: string; closed: boolean }> {
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
      this.logger.log(
        `[API] GET ${url} → status=${res.status} | events=${Array.isArray(res.data) ? res.data.length : 1}`,
      );

      const events: Array<{
        markets?: Array<{
          conditionId: string;
          question: string;
          closed?: boolean;
          resolved?: boolean;
          active?: boolean;
        }>;
      }> = Array.isArray(res.data) ? res.data : [res.data];

      const market = events[0]?.markets?.[0];
      if (!market?.conditionId)
        return { conditionId: '', question: '', closed: false };

      // Polymarket markets are closed when closed=true or resolved=true or active=false
      const closed =
        market.closed === true ||
        market.resolved === true ||
        market.active === false;
      this.logger.log(`conditionId: ${market.conditionId} | closed=${closed}`);
      return {
        conditionId: market.conditionId,
        question: market.question ?? slug,
        closed,
      };
    } catch (err) {
      this.logger.error(`[API] GET ${url} → FAILED`, err);
      return { conditionId: '', question: '', closed: false };
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
    this.logger.log(
      `[API] GET ${holdersUrl} | params: ${JSON.stringify({ market: conditionId, limit: 500 })}`,
    );
    try {
      const res = await firstValueFrom(
        this.httpService.get(holdersUrl, {
          params: { market: conditionId, limit: 500 },
          timeout: 15_000,
        }),
      );
      this.logger.log(
        `[API] GET ${holdersUrl} → status=${res.status} | groups=${Array.isArray(res.data) ? res.data.length : 0}`,
      );

      const groups: PolymarketTokenGroup[] = Array.isArray(res.data)
        ? res.data
        : [];

      const group = groups.find(
        (g) => g.holders?.[0]?.outcomeIndex === outcomeIndex,
      );
      if (!group?.holders?.length) {
        this.logger.warn(
          `No ${outcomeSide} holders found for market ${conditionId}`,
        );
        return [];
      }

      const top = group.holders.slice(0, this.appConfig.polymarketWinnerCount);
      this.logger.log(
        `Top ${outcomeSide} holders fetched: ${top.length} (of ${group.holders.length} total)`,
      );

      // Store in DB
      await this.winnerRepo.saveAll(
        top.map((h, i) => ({
          signalKey,
          marketId: conditionId,
          marketQuestion,
          walletAddress: h.proxyWallet,
          positionSize: String(h.amount),
          outcomeSide,
          candleInterval: interval,
          candleCloseTime: String(closeTime),
          positionRank: i + 1,
          displayName: h.name || h.pseudonym || null,
        })),
      );

      // Fetch and store wallet profiles for top holders in background (non-blocking)
      void this.fetchAndStoreWalletProfiles(
        top.map((h) => ({
          walletAddress: h.proxyWallet,
          name: h.name || h.pseudonym || null,
        })),
        conditionId,
        signalKey,
        closeTime,
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

  private async fetchAndStoreWalletProfiles(
    holders: { walletAddress: string; name: string | null }[],
    conditionId: string,
    signalKey: string,
    closeTime: number,
  ): Promise<void> {
    const profileUrl = `https://gamma-api.polymarket.com/public-profile`;
    const positionsUrl = `${this.appConfig.polymarketDataUrl}/positions`;
    const activityUrl = `${this.appConfig.polymarketDataUrl}/activity`;

    const results = await Promise.all(
      holders.map(async (h) => {
        // Run 3 API calls in parallel per wallet
        const [profileResult, positionsResult, activityResult] = await Promise.all([
          firstValueFrom(
            this.httpService.get<PolymarketPublicProfile>(profileUrl, {
              params: { address: h.walletAddress },
              timeout: 10_000,
            }),
          ).catch((err) => {
            this.errorLogService.log(err, { module: 'suspect-scoring' });
            return null;
          }),
          firstValueFrom(
            this.httpService.get<PolymarketUserPosition[]>(positionsUrl, {
              params: { user: h.walletAddress, limit: 500 },
              timeout: 15_000,
            }),
          ).catch((err) => {
            this.errorLogService.log(err, { module: 'suspect-scoring' });
            return null;
          }),
          firstValueFrom(
            this.httpService.get<unknown[]>(activityUrl, {
              params: { user: h.walletAddress, side: 'SELL', limit: 1 },
              timeout: 10_000,
            }),
          ).catch((err) => {
            this.errorLogService.log(err, { module: 'suspect-scoring' });
            return null;
          }),
        ]);

        // --- Criterion 1: new wallet (createdAt within 5 days of signal closeTime) ---
        const createdAtStr = profileResult?.data?.createdAt ?? null;
        const criterionNewWallet = evalNewWallet(createdAtStr, closeTime);

        // --- Criterion 2: buy-only (zero SELL trades) ---
        const criterionBuyOnly =
          activityResult !== null
            ? evalBuyOnly(Array.isArray(activityResult.data) ? activityResult.data : [])
            : null;

        // --- Criteria 3 & 4: find position for this signal's market ---
        let criterionPositionValue: boolean | null = null;
        let criterionConviction: boolean | null = null;
        if (positionsResult !== null) {
          const positions: PolymarketUserPosition[] = Array.isArray(positionsResult.data)
            ? positionsResult.data
            : [];
          const marketPosition = positions.find((p) => p.conditionId === conditionId);
          if (marketPosition) {
            criterionPositionValue = evalPositionValue(marketPosition.currentValue);
            criterionConviction = evalConviction(marketPosition.avgPrice);
          }
        }

        // --- Compute score ---
        const suspectScore = computeSuspectScore(
          criterionNewWallet,
          criterionBuyOnly,
          criterionPositionValue,
          criterionConviction,
        );

        // --- Store wallet profile (reuse positions response) ---
        if (positionsResult !== null) {
          const positions: PolymarketUserPosition[] = Array.isArray(positionsResult.data)
            ? positionsResult.data
            : [];
          const totalCurrentValue = positions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
          const totalRealizedPnl = positions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
          const totalCashPnl = positions.reduce((s, p) => s + (p.cashPnl ?? 0), 0);
          const btcUpdownPositions = positions.filter((p) =>
            p.eventSlug?.startsWith('btc-updown'),
          ).length;
          const categoryCounts: Record<string, number> = {};
          for (const p of positions) {
            const cat = p.eventSlug?.split('-')[0] ?? 'other';
            categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
          }
          const favoriteCategories = Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          await this.walletProfileRepo
            .upsertMany([{
              walletAddress: h.walletAddress,
              displayName: h.name,
              totalPositions: positions.length,
              totalCurrentValue: String(totalCurrentValue),
              totalRealizedPnl: String(totalRealizedPnl),
              totalCashPnl: String(totalCashPnl),
              btcUpdownPositions,
              favoriteCategories,
            }])
            .catch((err) =>
              this.errorLogService.log(err, { module: 'polymarket-profiles' }),
            );
        }

        return {
          walletAddress: h.walletAddress,
          signalKey,
          suspectScore,
          criterionNewWallet,
          criterionBuyOnly,
          criterionPositionValue,
          criterionConviction,
        };
      }),
    );

    // Write all scores in one batch (partial nulls included — never skip)
    await this.winnerRepo
      .updateSuspectScores(results)
      .catch((err) => this.errorLogService.log(err, { module: 'suspect-scoring' }));

    this.logger.log(`Suspect scores written for ${results.length} wallets on signal ${signalKey}`);
  }

  private async getTopPositionsByPnl(
    conditionId: string,
    marketQuestion: string,
    outcomeIndex: number,
  ): Promise<IPosition[]> {
    const side = outcomeIndex === 1 ? 'Down' : 'Up';
    const positionsUrl = `${this.appConfig.polymarketDataUrl}/v1/market-positions`;
    const positionsParams = {
      market: conditionId,
      limit: 500,
      sortBy: 'TOTAL_PNL',
      sortDirection: 'DESC',
    };
    this.logger.log(
      `[API] GET ${positionsUrl} | params: ${JSON.stringify(positionsParams)}`,
    );
    try {
      const res = await firstValueFrom(
        this.httpService.get(positionsUrl, {
          params: positionsParams,
          timeout: 15_000,
        }),
      );
      this.logger.log(
        `[API] GET ${positionsUrl} → status=${res.status} | groups=${Array.isArray(res.data) ? res.data.length : 0}`,
      );

      const groups: PolymarketPositionGroup[] = Array.isArray(res.data)
        ? res.data
        : [];

      const group = groups.find(
        (g) => g.positions?.[0]?.outcomeIndex === outcomeIndex,
      );
      if (!group?.positions?.length) {
        this.logger.warn(
          `No ${side} positions found for market ${conditionId}`,
        );
        return [];
      }

      const top = group.positions
        .filter((p) => p.totalPnl > 0)
        .slice(0, this.appConfig.polymarketWinnerCount);

      this.logger.log(
        `Top ${side} positions by PNL fetched: ${top.length} (of ${group.positions.length} total, filtered positive PNL)`,
      );

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
