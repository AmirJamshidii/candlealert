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

  @UpdateDateColumn()
  fetchedAt: Date;
}
