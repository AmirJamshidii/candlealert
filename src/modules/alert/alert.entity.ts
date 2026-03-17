import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('alerts')
@Unique(['signalKey', 'chatId'])
export class AlertEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  signalKey: string;

  @Column({ length: 50 })
  chatId: string;

  @Column({ length: 10 })
  interval: string;

  @Column({ type: 'bigint' })
  candleCloseTime: string;

  @Column({ length: 20, nullable: true })
  direction: string | null;

  @CreateDateColumn()
  sentAt: Date;
}
