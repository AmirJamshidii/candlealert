import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('polymarket_winners')
@Index(['signalKey'])
@Index(['walletAddress'])
export class PolymarketWinnerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  signalKey: string;

  @Column({ length: 255 })
  marketId: string;

  @Column({ type: 'text' })
  marketQuestion: string;

  @Column({ length: 42 })
  walletAddress: string;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  positionSize: string;

  @Column({ length: 20 })
  outcomeSide: string;

  @Column({ length: 10 })
  candleInterval: string;

  @Column({ type: 'bigint' })
  candleCloseTime: string;

  @Column({ length: 100, nullable: true })
  displayName: string | null;

  @Column({ nullable: true })
  positionRank: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true })
  avgPrice: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true })
  totalPnl: string | null;

  @Column({ length: 20, nullable: true })
  marketResolvedOutcome: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
