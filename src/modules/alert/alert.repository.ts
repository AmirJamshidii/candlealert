import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEntity } from './alert.entity';

@Injectable()
export class AlertRepository {
  constructor(
    @InjectRepository(AlertEntity)
    private readonly repo: Repository<AlertEntity>,
  ) {}

  async isDuplicate(signalKey: string, chatId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { signalKey, chatId } });
    return count > 0;
  }

  async record(signalKey: string, chatId: string, interval: string, candleCloseTime: number): Promise<void> {
    await this.repo.save({ signalKey, chatId, interval, candleCloseTime: String(candleCloseTime) });
  }

  async getRecent(limit = 100): Promise<AlertEntity[]> {
    return this.repo.find({ order: { sentAt: 'DESC' }, take: limit });
  }

  async countByInterval(): Promise<{ interval: string; count: number }[]> {
    const rows = await this.repo.manager.query(
      `SELECT interval, COUNT(*)::int AS count FROM alerts GROUP BY interval ORDER BY interval`,
    );
    return rows;
  }

  async getTimeline(days: number): Promise<{ date: string; count: number }[]> {
    const rows = await this.repo.manager.query(
      `SELECT DATE(sent_at)::text AS date, COUNT(*)::int AS count
       FROM alerts
       WHERE sent_at >= NOW() - ($1 || ' days')::interval
       GROUP BY DATE(sent_at)
       ORDER BY DATE(sent_at) ASC`,
      [days],
    );
    return rows;
  }
}
