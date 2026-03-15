import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolymarketWinnerEntity } from './polymarket-winner.entity';

@Injectable()
export class PolymarketWinnerRepository {
  constructor(
    @InjectRepository(PolymarketWinnerEntity)
    private readonly repo: Repository<PolymarketWinnerEntity>,
  ) {}

  async saveAll(winners: Partial<PolymarketWinnerEntity>[]): Promise<void> {
    await this.repo.save(winners);
  }

  async getRecentBySignal(signalKey: string): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({
      where: { signalKey },
      order: { positionSize: 'DESC' },
    });
  }

  async getRecent(limit = 100): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async getLeaderboard(
    limit: number,
    interval?: string,
  ): Promise<{ walletAddress: string; totalPosition: number; signalCount: number }[]> {
    const rows = await this.repo.manager.query(
      `SELECT wallet_address AS "walletAddress",
              SUM(position_size::numeric) AS "totalPosition",
              COUNT(DISTINCT signal_key)::int AS "signalCount"
       FROM polymarket_winners
       WHERE ($1::text IS NULL OR candle_interval = $1)
       GROUP BY wallet_address
       ORDER BY SUM(position_size::numeric) DESC
       LIMIT $2`,
      [interval ?? null, limit],
    );
    return rows.map((r: Record<string, string>) => ({
      walletAddress: r.walletAddress,
      totalPosition: parseFloat(r.totalPosition),
      signalCount: parseInt(r.signalCount, 10),
    }));
  }

  async getHolderLeaderboard(
    days: number,
    limit: number,
    interval?: string,
  ): Promise<{ walletAddress: string; signalCount: number; totalPosition: number }[]> {
    const rows = await this.repo.manager.query(
      `SELECT wallet_address AS "walletAddress",
              COUNT(DISTINCT signal_key)::int AS "signalCount",
              SUM(position_size::numeric) AS "totalPosition"
       FROM polymarket_winners
       WHERE created_at >= NOW() - ($1 || ' days')::interval
         AND ($2::text IS NULL OR candle_interval = $2)
       GROUP BY wallet_address
       ORDER BY COUNT(DISTINCT signal_key) DESC, SUM(position_size::numeric) DESC
       LIMIT $3`,
      [days, interval ?? null, limit],
    );
    return rows.map((r: Record<string, string>) => ({
      walletAddress: r.walletAddress,
      signalCount: parseInt(r.signalCount, 10),
      totalPosition: parseFloat(r.totalPosition),
    }));
  }

  async getHolderHistory(walletAddress: string): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({
      where: { walletAddress },
      order: { createdAt: 'DESC' },
    });
  }
}
