import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AlertRepository } from '../alert/alert.repository';
import { PolymarketWinnerRepository } from '../polymarket/polymarket-winner.repository';
import { WalletProfileRepository } from '../polymarket/wallet-profile.repository';
import { ErrorLogService } from '../error-log/error-log.service';
import { PolymarketWinnerEntity } from '../polymarket/polymarket-winner.entity';
import { AppConfig } from '../../config/app.config';
import { SignalMetricsRepository } from '../signal-metrics/signal-metrics.repository';
import { SignalMetricsEntity } from '../signal-metrics/signal-metrics.entity';
import { CandleBufferService } from '../binance/candle-buffer.service';

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
    private readonly signalMetricsRepo: SignalMetricsRepository,
    private readonly candleBuffer: CandleBufferService,
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

  getDirectionBreakdown(): Promise<
    { interval: string; direction: string; count: number }[]
  > {
    return this.alertRepo.getDirectionBreakdown();
  }

  getWinnerLeaderboard(
    limit: number,
    interval?: string,
  ): Promise<
    { walletAddress: string; totalPosition: number; signalCount: number }[]
  > {
    return this.winnerRepo.getLeaderboard(limit, interval);
  }

  getWinnersBySignal(signalKey: string): Promise<PolymarketWinnerEntity[]> {
    return this.winnerRepo.getRecentBySignal(signalKey);
  }

  getHolderLeaderboard(
    days: number,
    limit: number,
    interval?: string,
  ): Promise<
    { walletAddress: string; signalCount: number; totalPosition: number }[]
  > {
    return this.winnerRepo.getHolderLeaderboard(days, limit, interval);
  }

  getWinRateLeaderboard(
    days: number,
    limit: number,
    minAppearances: number,
  ): Promise<
    {
      walletAddress: string;
      appearances: number;
      avgPnl: number;
      totalPnl: number;
    }[]
  > {
    return this.winnerRepo.getWinRateLeaderboard(days, limit, minAppearances);
  }

  getTopSuspects(
    days: number,
    limit: number,
  ): Promise<
    {
      walletAddress: string;
      displayName: string | null;
      signalCount: number;
      totalWagered: number;
      totalPnl: number;
      btcRatio: number;
      winRate: number;
      suspectScore: number;
      criterionNewWallet: boolean | null;
      criterionBuyOnly: boolean | null;
      criterionPositionValue: boolean | null;
      criterionConviction: boolean | null;
    }[]
  > {
    return this.winnerRepo.getTopSuspectsPersisted(days, limit);
  }

  getSignalMetrics(signalKey: string): Promise<SignalMetricsEntity | null> {
    return this.signalMetricsRepo.findBySignalKey(signalKey);
  }

  getHighScoringSignals(
    minScore: number,
    limit: number,
  ): Promise<SignalMetricsEntity[]> {
    return this.signalMetricsRepo.getHighScoring(minScore, limit);
  }

  getHolderHistory(walletAddress: string): Promise<PolymarketWinnerEntity[]> {
    return this.winnerRepo.getHolderHistory(walletAddress);
  }

  getErrors(limit: number, module?: string) {
    return this.errorLogService.getRecent(limit, module);
  }

  async getSignalCount(sinceMs?: number): Promise<{ count: number }> {
    const count = await this.alertRepo.countSince(sinceMs);
    return { count };
  }

  async getHolderCount(sinceMs?: number): Promise<{ count: number }> {
    const count = await this.winnerRepo.countHoldersSince(sinceMs);
    return { count };
  }

  async getBtcCandles(
    interval: string,
    limit: number,
    since?: number,
    until?: number,
  ): Promise<{
    candles: {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }[];
    signals: { time: number; direction: string | null }[];
  }> {
    if (since !== undefined && until !== undefined) {
      const intervalMs = this.parseIntervalMs(interval);
      // since/until are candle open times in Unix seconds
      // candle_close_time = open_time_ms + intervalMs - 1
      const sinceCloseMs = since * 1000 + intervalMs - 1;
      const untilCloseMs = until * 1000 + intervalMs - 1;
      const rows = await this.alertRepo.getSignalsByIntervalBetween(
        interval,
        sinceCloseMs,
        untilCloseMs,
      );
      const signals = rows.map((r) => ({
        time: Math.floor((r.candleCloseTimeMs - intervalMs + 1) / 1000),
        direction: r.direction,
      }));
      return { candles: [], signals };
    }

    const buffered = this.candleBuffer.getCandles(interval, limit);
    const candles = buffered.map((c) => ({
      time: Math.floor(c.openTime / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    let signals: { time: number; direction: string | null }[] = [];
    if (candles.length > 0) {
      const earliestMs = candles[0].time * 1000;
      const intervalMs = this.parseIntervalMs(interval);
      const rows = await this.alertRepo.getSignalsByIntervalSince(
        interval,
        earliestMs,
      );
      signals = rows.map((r) => ({
        // openTime = closeTime - intervalMs + 1; convert ms → seconds
        time: Math.floor((r.candleCloseTimeMs - intervalMs + 1) / 1000),
        direction: r.direction,
      }));
    }

    return { candles, signals };
  }

  private parseIntervalMs(interval: string): number {
    const m = interval.match(/^(\d+)([mhd])$/);
    if (!m) return 300_000;
    const n = parseInt(m[1], 10);
    if (m[2] === 'm') return n * 60_000;
    if (m[2] === 'h') return n * 3_600_000;
    if (m[2] === 'd') return n * 86_400_000;
    return 300_000;
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
    signalScore?: number;
    snapshotPrice?: number | null;
    snapshotDeltaPct?: number | null;
    rejectionWick?: number;
  } | null> {
    // Serve from DB first (no external call needed)
    const stored = await this.signalMetricsRepo.findBySignalKey(signalKey);
    if (stored) {
      const open = parseFloat(stored.open);
      const high = parseFloat(stored.high);
      const low = parseFloat(stored.low);
      const close = parseFloat(stored.close);
      const range = high - low;
      return {
        openTime: parseInt(stored.candleOpenTime, 10),
        open,
        high,
        low,
        close,
        volume: parseFloat(stored.volume),
        closeTime: parseInt(stored.candleCloseTime, 10),
        bodySize: parseFloat(stored.bodySize),
        wickRatio: range > 0 ? parseFloat(stored.bodySize) / range : 0,
        signalScore: parseFloat(stored.signalScore),
        snapshotPrice: stored.snapshotPrice
          ? parseFloat(stored.snapshotPrice)
          : null,
        snapshotDeltaPct: stored.snapshotDeltaPct
          ? parseFloat(stored.snapshotDeltaPct)
          : null,
        rejectionWick: parseFloat(stored.rejectionWick),
      };
    }

    // Fall back to in-memory buffer for recent signals
    const parts = signalKey.split(':');
    // Signal key format: reversal:BTCUSDT:<interval>:<closeTime>
    const interval = parts[2];
    const closeTimeMs = parts[3] ? parseInt(parts[3], 10) : NaN;
    if (interval && !isNaN(closeTimeMs)) {
      const intervalMs = this.parseIntervalMs(interval);
      const openTime = closeTimeMs - intervalMs + 1;
      const candle = this.candleBuffer.getCandleByOpenTime(interval, openTime);
      if (candle) {
        const range = candle.high - candle.low;
        return {
          openTime: candle.openTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          closeTime: candle.closeTime,
          bodySize: Math.abs(candle.close - candle.open),
          wickRatio:
            range > 0 ? Math.abs(candle.close - candle.open) / range : 0,
        };
      }
    }

    return null;
  }

  async getWalletProfile(address: string): Promise<{
    walletAddress: string;
    displayName: string | null;
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
        displayName: stored.displayName ?? null,
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
        this.httpService.get(url, {
          params: { user: address, limit: 500 },
          timeout: 15_000,
        }),
      );
      const positions: PolymarketUserPosition[] = Array.isArray(res.data)
        ? res.data
        : [];

      const totalCurrentValue = positions.reduce(
        (s, p) => s + (p.currentValue ?? 0),
        0,
      );
      const totalRealizedPnl = positions.reduce(
        (s, p) => s + (p.realizedPnl ?? 0),
        0,
      );
      const totalCashPnl = positions.reduce((s, p) => s + (p.cashPnl ?? 0), 0);
      const btcUpdownPositions = positions.filter((p) =>
        p.eventSlug?.startsWith('btc-updown'),
      ).length;

      const categoryCounts: Record<string, number> = {};
      for (const p of positions) {
        const category = p.eventSlug?.split('-')[0] ?? 'other';
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      }
      const favoriteCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Persist for future requests (name unknown from this path)
      await this.walletProfileRepo
        .upsert({
          walletAddress: address,
          totalPositions: positions.length,
          totalCurrentValue: String(totalCurrentValue),
          totalRealizedPnl: String(totalRealizedPnl),
          totalCashPnl: String(totalCashPnl),
          btcUpdownPositions,
          favoriteCategories,
        })
        .catch(() => {
          /* non-critical */
        });

      return {
        walletAddress: address,
        displayName: null,
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
