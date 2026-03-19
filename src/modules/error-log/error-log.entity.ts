import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('error_logs')
@Index(['createdAt'])
export class ErrorLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: true })
  module: string;

  @Column('text')
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string;

  @CreateDateColumn()
  createdAt: Date;
}
