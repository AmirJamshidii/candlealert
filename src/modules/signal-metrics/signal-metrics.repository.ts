import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignalMetricsEntity } from './signal-metrics.entity';

@Injectable()
export class SignalMetricsRepository {
  constructor(
    @InjectRepository(SignalMetricsEntity)
    private readonly repo: Repository<SignalMetricsEntity>,
  ) {}

  async save(metrics: Partial<SignalMetricsEntity>): Promise<void> {
    await this.repo.save(metrics);
  }

  async findBySignalKey(
    signalKey: string,
  ): Promise<SignalMetricsEntity | null> {
    return this.repo.findOne({ where: { signalKey } });
  }

  async getHighScoring(
    minScore: number,
    limit: number,
  ): Promise<SignalMetricsEntity[]> {
    return this.repo
      .createQueryBuilder('sm')
      .where('sm.signalScore >= :minScore', { minScore })
      .orderBy('sm.signalScore', 'DESC')
      .addOrderBy('sm.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
