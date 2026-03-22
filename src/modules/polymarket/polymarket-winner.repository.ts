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

  async getRecentBySignal(
    signalKey: string,
  ): Promise<PolymarketWinnerEntity[]> {
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
  ): Promise<
    {
      walletAddress: string;
      displayName: string | null;
      totalPosition: number;
      signalCount: number;
    }[]
  > {
    const rows = await this.repo.manager.query(
      `SELECT wallet_address AS "walletAddress",
              MAX(display_name) AS "displayName",
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
      displayName: r.displayName ?? null,
      totalPosition: parseFloat(r.totalPosition),
      signalCount: parseInt(r.signalCount, 10),
    }));
  }

  async getHolderLeaderboard(
    days: number,
    limit: number,
    interval?: string,
  ): Promise<
    {
      walletAddress: string;
      displayName: string | null;
      signalCount: number;
      totalPosition: number;
    }[]
  > {
    const rows = await this.repo.manager.query(
      `SELECT wallet_address AS "walletAddress",
              MAX(display_name) AS "displayName",
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
      displayName: r.displayName ?? null,
      signalCount: parseInt(r.signalCount, 10),
      totalPosition: parseFloat(r.totalPosition),
    }));
  }

  async getHolderHistory(
    walletAddress: string,
  ): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({
      where: { walletAddress },
      order: { createdAt: 'DESC' },
    });
  }

  async countHoldersSince(sinceMs?: number): Promise<number> {
    if (sinceMs !== undefined) {
      const rows = await this.repo.manager.query(
        `SELECT COUNT(DISTINCT wallet_address)::int AS count
         FROM polymarket_winners
         WHERE created_at >= to_timestamp($1 / 1000.0)`,
        [sinceMs],
      );
      return parseInt(rows[0].count, 10);
    }
    const rows = await this.repo.manager.query(
      `SELECT COUNT(DISTINCT wallet_address)::int AS count FROM polymarket_winners`,
    );
    return parseInt(rows[0].count, 10);
  }

  async getTopSuspectsPersisted(
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
    const rows = await this.repo.manager.query(
      `SELECT
         pw_all.wallet_address AS "walletAddress",
         COALESCE(MAX(wp.display_name), MAX(pw_all.display_name)) AS "displayName",
         COUNT(DISTINCT pw_all.signal_key)::int AS "signalCount",
         SUM(pw_all.position_size::numeric) AS "totalWagered",
         COALESCE(SUM(pw_all.total_pnl::numeric), 0) AS "totalPnl",
         COALESCE(
           CASE WHEN MAX(wp.total_positions) > 0
             THEN MAX(wp.btc_updown_positions)::numeric / MAX(wp.total_positions)
             ELSE 0
           END, 0
         ) AS "btcRatio",
         COALESCE(MAX(wp.win_rate)::numeric, 0) AS "winRate",
         COALESCE(MAX(pw_all.suspect_score)::numeric, 0) AS "suspectScore",
         best.criterion_new_wallet AS "criterionNewWallet",
         best.criterion_buy_only AS "criterionBuyOnly",
         best.criterion_position_value AS "criterionPositionValue",
         best.criterion_conviction AS "criterionConviction"
       FROM polymarket_winners pw_all
       LEFT JOIN wallet_profiles wp ON pw_all.wallet_address = wp.wallet_address
       JOIN LATERAL (
         SELECT criterion_new_wallet, criterion_buy_only,
                criterion_position_value, criterion_conviction
         FROM polymarket_winners
         WHERE wallet_address = pw_all.wallet_address
         ORDER BY suspect_score DESC NULLS LAST
         LIMIT 1
       ) best ON true
       WHERE pw_all.created_at >= NOW() - ($1 || ' days')::interval
       GROUP BY pw_all.wallet_address,
                best.criterion_new_wallet,
                best.criterion_buy_only,
                best.criterion_position_value,
                best.criterion_conviction
       ORDER BY COALESCE(MAX(pw_all.suspect_score)::numeric, 0) DESC NULLS LAST
       LIMIT $2`,
      [days, limit],
    );
    return rows.map((r: Record<string, string>) => ({
      walletAddress: r.walletAddress,
      displayName: r.displayName ?? null,
      signalCount: parseInt(r.signalCount, 10),
      totalWagered: parseFloat(r.totalWagered ?? '0'),
      totalPnl: parseFloat(r.totalPnl ?? '0'),
      btcRatio: parseFloat(r.btcRatio ?? '0'),
      winRate: parseFloat(r.winRate ?? '0'),
      suspectScore: parseFloat(r.suspectScore ?? '0'),
      criterionNewWallet: r.criterionNewWallet === null ? null : r.criterionNewWallet === 'true' || (r.criterionNewWallet as unknown) === true,
      criterionBuyOnly: r.criterionBuyOnly === null ? null : r.criterionBuyOnly === 'true' || (r.criterionBuyOnly as unknown) === true,
      criterionPositionValue: r.criterionPositionValue === null ? null : r.criterionPositionValue === 'true' || (r.criterionPositionValue as unknown) === true,
      criterionConviction: r.criterionConviction === null ? null : r.criterionConviction === 'true' || (r.criterionConviction as unknown) === true,
    }));
  }

  async updateSuspectScores(
    updates: Array<{
      walletAddress: string;
      signalKey: string;
      suspectScore: number;
      criterionNewWallet: boolean | null;
      criterionBuyOnly: boolean | null;
      criterionPositionValue: boolean | null;
      criterionConviction: boolean | null;
    }>,
  ): Promise<void> {
    if (!updates.length) return;
    await Promise.all(
      updates.map((u) =>
        this.repo.manager.query(
          `UPDATE polymarket_winners
           SET suspect_score            = $1,
               criterion_new_wallet     = $2,
               criterion_buy_only       = $3,
               criterion_position_value = $4,
               criterion_conviction     = $5
           WHERE wallet_address = $6 AND signal_key = $7`,
          [
            u.suspectScore,
            u.criterionNewWallet,
            u.criterionBuyOnly,
            u.criterionPositionValue,
            u.criterionConviction,
            u.walletAddress,
            u.signalKey,
          ],
        ),
      ),
    );
  }

  async getWinRateLeaderboard(
    days: number,
    limit: number,
    minAppearances = 3,
  ): Promise<
    {
      walletAddress: string;
      displayName: string | null;
      appearances: number;
      avgPnl: number;
      totalPnl: number;
    }[]
  > {
    const rows = await this.repo.manager.query(
      `SELECT wallet_address AS "walletAddress",
              MAX(display_name) AS "displayName",
              COUNT(DISTINCT signal_key)::int AS appearances,
              AVG(total_pnl::numeric) AS "avgPnl",
              SUM(total_pnl::numeric) AS "totalPnl"
       FROM polymarket_winners
       WHERE created_at >= NOW() - ($1 || ' days')::interval
         AND total_pnl IS NOT NULL
       GROUP BY wallet_address
       HAVING COUNT(DISTINCT signal_key) >= $2
       ORDER BY AVG(total_pnl::numeric) DESC
       LIMIT $3`,
      [days, minAppearances, limit],
    );
    return rows.map((r: Record<string, string>) => ({
      walletAddress: r.walletAddress,
      displayName: r.displayName ?? null,
      appearances: parseInt(r.appearances, 10),
      avgPnl: parseFloat(r.avgPnl ?? '0'),
      totalPnl: parseFloat(r.totalPnl ?? '0'),
    }));
  }
}
