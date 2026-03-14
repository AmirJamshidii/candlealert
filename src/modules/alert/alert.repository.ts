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
}
