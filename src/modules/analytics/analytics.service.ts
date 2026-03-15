import { Injectable } from '@nestjs/common';
import { AlertRepository } from '../alert/alert.repository';
import { PolymarketWinnerRepository } from '../polymarket/polymarket-winner.repository';
import { ErrorLogService } from '../error-log/error-log.service';
import { PolymarketWinnerEntity } from '../polymarket/polymarket-winner.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly alertRepo: AlertRepository,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly errorLogService: ErrorLogService,
  ) {}

  getSignalSummary(): Promise<{ interval: string; count: number }[]> {
    return this.alertRepo.countByInterval();
  }

  getSignalTimeline(days: number): Promise<{ date: string; count: number }[]> {
    return this.alertRepo.getTimeline(days);
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

  getHolderHistory(walletAddress: string): Promise<PolymarketWinnerEntity[]> {
    return this.winnerRepo.getHolderHistory(walletAddress);
  }

  getErrors(limit: number, module?: string) {
    return this.errorLogService.getRecent(limit, module);
  }
}
