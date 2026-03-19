import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('signal_metrics')
@Index(['interval'])
@Index(['signalScore'])
export class SignalMetricsEntity {
  @PrimaryColumn({ length: 255 })
  signalKey: string;

  @Column({ length: 10 })
  interval: string;

  @Column({ length: 20 })
  direction: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  open: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  high: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  low: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  close: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  volume: string;

  @Column({ type: 'bigint' })
  candleOpenTime: string;

  @Column({ type: 'bigint' })
  candleCloseTime: string;

  @Column({ type: 'numeric', precision: 20, scale: 8, nullable: true })
  snapshotPrice: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 8, nullable: true })
  snapshotDelta: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  snapshotDeltaPct: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  bodySize: string;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  bodySizePct: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  upperWick: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  lowerWick: string;

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  rejectionWick: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  signalScore: string;

  @CreateDateColumn()
  createdAt: Date;
}
