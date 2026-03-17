import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AlertRepository } from '../alert/alert.repository';
import { PolymarketWinnerRepository } from '../polymarket/polymarket-winner.repository';
import { WalletProfileRepository } from '../polymarket/wallet-profile.repository';
import { ErrorLogService } from '../error-log/error-log.service';
import { PolymarketWinnerEntity } from '../polymarket/polymarket-winner.entity';
import { AppConfig } from '../../config/app.config';

interface PolymarketUserPosition {
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  title: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  endDate: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly alertRepo: AlertRepository,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly walletProfileRepo: WalletProfileRepository,
    private readonly errorLogService: ErrorLogService,
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
  ) {}

  getSignalSummary(): Promise<{ interval: string; count: number }[]> {
    return this.alertRepo.countByInterval();
  }

  getSignalTimeline(days: number): Promise<{ date: string; count: number }[]> {
    return this.alertRepo.getTimeline(days);
  }

  getSignalHeatmap(): Promise<{ hour: number; count: number }[]> {
    return this.alertRepo.getHeatmap();
  }

  getDirectionBreakdown(): Promise<{ interval: string; direction: string; count: number }[]> {
    return this.alertRepo.getDirectionBreakdown();
  }

  getWinnerLeaderboard(
    limit: number,
    interval?: string,
  ): Promise<{ walletAddress: string; totalPosition: number; signalCount: number }[]> {
    return this.winnerRepo.getLeaderboard(limit, interval);
  }

  getWinnersBySignal(signalKey: string): Promise<PolymarketWinnerEntity[]> {
    return this.winnerRepo.getRecentBySignal(signalKey);
  }

  getHolderLeaderboard(
    days: number,
    limit: number,
    interval?: string,
  ): Promise<{ walletAddress: string; signalCount: number; totalPosition: number }[]> {
    return this.winnerRepo.getHolderLeaderboard(days, limit, interval);
  }

  getWinRateLeaderboard(
    days: number,
    limit: number,
    minAppearances: number,
  ): Promise<{ walletAddress: string; appearances: number; avgPnl: number; totalPnl: number }[]> {
    return this.winnerRepo.getWinRateLeaderboard(days, limit, minAppearances);
  }

  getHolderHistory(walletAddress: string): Promise<PolymarketWinnerEntity[]> {
    return this.winnerRepo.getHolderHistory(walletAddress);
  }

  getErrors(limit: number, module?: string) {
    return this.errorLogService.getRecent(limit, module);
  }

  async getCandleForSignal(signalKey: string): Promise<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
    bodySize: number;
    wickRatio: number;
  } | null> {
    const [interval, openTimeStr] = signalKey.split(':');
    if (!interval || !openTimeStr) return null;

    const openTime = parseInt(openTimeStr, 10);
    const url = `${this.appConfig.binanceBaseUrl}/api/v3/klines`;

    try {
      const res = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: 'BTCUSDT', interval, startTime: openTime, limit: 1 },
          timeout: 10_000,
        }),
      );

      const kline = res.data?.[0];
      if (!kline) return null;

      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const range = high - low;

      return {
        openTime: parseInt(kline[0], 10),
        open,
        high,
        low,
        close,
        volume: parseFloat(kline[5]),
        closeTime: parseInt(kline[6], 10),
        bodySize: Math.abs(close - open),
        wickRatio: range > 0 ? Math.abs(close - open) / range : 0,
      };
    } catch (err) {
      this.logger.error(`Failed to fetch candle for ${signalKey}`, err);
      return null;
    }
  }

  async getWalletProfile(address: string): Promise<{
    walletAddress: string;
    totalPositions: number;
    totalCurrentValue: number;
    totalRealizedPnl: number;
    totalCashPnl: number;
    btcUpdownPositions: number;
    favoriteCategories: { category: string; count: number }[];
    fetchedAt?: Date;
  } | null> {
    // Serve from DB if available
    const stored = await this.walletProfileRepo.findByAddress(address);
    if (stored) {
      return {
        walletAddress: stored.walletAddress,
        totalPositions: stored.totalPositions,
        totalCurrentValue: parseFloat(stored.totalCurrentValue),
        totalRealizedPnl: parseFloat(stored.totalRealizedPnl),
        totalCashPnl: parseFloat(stored.totalCashPnl),
        btcUpdownPositions: stored.btcUpdownPositions,
        favoriteCategories: stored.favoriteCategories,
        fetchedAt: stored.fetchedAt,
      };
    }

    // Fallback: fetch live from Polymarket and store result
    const url = `${this.appConfig.polymarketDataUrl}/positions`;
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, { params: { user: address, limit: 500 }, timeout: 15_000 }),
      );
      const positions: PolymarketUserPosition[] = Array.isArray(res.data) ? res.data : [];

      const totalCurrentValue = positions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
      const totalRealizedPnl = positions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
      const totalCashPnl = positions.reduce((s, p) => s + (p.cashPnl ?? 0), 0);
      const btcUpdownPositions = positions.filter((p) => p.eventSlug?.startsWith('btc-updown')).length;

      const categoryCounts: Record<string, number> = {};
      for (const p of positions) {
        const category = p.eventSlug?.split('-')[0] ?? 'other';
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      }
      const favoriteCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Persist for future requests
      await this.walletProfileRepo.upsert({
        walletAddress: address,
        totalPositions: positions.length,
        totalCurrentValue: String(totalCurrentValue),
        totalRealizedPnl: String(totalRealizedPnl),
        totalCashPnl: String(totalCashPnl),
        btcUpdownPositions,
        favoriteCategories,
      }).catch(() => { /* non-critical */ });

      return {
        walletAddress: address,
        totalPositions: positions.length,
        totalCurrentValue,
        totalRealizedPnl,
        totalCashPnl,
        btcUpdownPositions,
        favoriteCategories,
      };
    } catch (err) {
      this.logger.error(`Failed to fetch wallet profile for ${address}`, err);
      return null;
    }
  }
}
