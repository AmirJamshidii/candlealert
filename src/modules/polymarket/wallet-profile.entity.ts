import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('wallet_profiles')
export class WalletProfileEntity {
  @PrimaryColumn({ length: 42 })
  walletAddress: string;

  @Column({ length: 100, nullable: true })
  displayName: string | null;

  @Column({ default: 0 })
  totalPositions: number;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  totalCurrentValue: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  totalRealizedPnl: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  totalCashPnl: string;

  @Column({ default: 0 })
  btcUpdownPositions: number;

  @Column({ type: 'jsonb', default: '[]' })
  favoriteCategories: { category: string; count: number }[];

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  suspectScore: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  winRate: string | null;

  @Column({ nullable: true })
  signalCount: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true })
  totalWagered: string | null;

  @UpdateDateColumn()
  fetchedAt: Date;
}
