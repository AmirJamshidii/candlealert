import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletProfileEntity } from './wallet-profile.entity';

@Injectable()
export class WalletProfileRepository {
  constructor(
    @InjectRepository(WalletProfileEntity)
    private readonly repo: Repository<WalletProfileEntity>,
  ) {}

  async upsert(profile: Partial<WalletProfileEntity>): Promise<void> {
    await this.repo.save(profile);
  }

  async upsertMany(profiles: Partial<WalletProfileEntity>[]): Promise<void> {
    if (!profiles.length) return;
    await this.repo.save(profiles);
  }

  async findByAddress(
    walletAddress: string,
  ): Promise<WalletProfileEntity | null> {
    return this.repo.findOne({ where: { walletAddress } });
  }

  async getAllForScoring(): Promise<
    Array<{
      walletAddress: string;
      signalCount: number;
      totalWagered: number;
      totalPnl: number;
      btcRatio: number;
      winRate: number;
    }>
  > {
    return this.repo.manager.query(`
      SELECT pw.wallet_address AS "walletAddress",
             COUNT(DISTINCT pw.signal_key)::int AS "signalCount",
             SUM(pw.position_size::numeric) AS "totalWagered",
             COALESCE(SUM(pw.total_pnl::numeric), 0) AS "totalPnl",
             COALESCE(
               CASE WHEN MAX(wp.total_positions) > 0
                 THEN MAX(wp.btc_updown_positions)::numeric / MAX(wp.total_positions)
                 ELSE 0
               END, 0
             ) AS "btcRatio",
             COALESCE(
               COUNT(CASE WHEN pw.total_pnl::numeric > 0 THEN 1 END)::float
               / NULLIF(COUNT(*), 0), 0
             ) AS "winRate"
      FROM polymarket_winners pw
      LEFT JOIN wallet_profiles wp ON pw.wallet_address = wp.wallet_address
      GROUP BY pw.wallet_address
    `);
  }

  async updateSuspectScores(
    updates: Array<{
      walletAddress: string;
      suspectScore: string;
      winRate: string;
      signalCount: number;
      totalWagered: string;
    }>,
  ): Promise<void> {
    if (!updates.length) return;
    await this.repo.save(
      updates.map((u) => ({
        walletAddress: u.walletAddress,
        suspectScore: u.suspectScore,
        winRate: u.winRate,
        signalCount: u.signalCount,
        totalWagered: u.totalWagered,
      })),
    );
  }
}
