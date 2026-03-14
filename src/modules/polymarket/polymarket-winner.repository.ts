import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolymarketWinnerEntity } from './polymarket-winner.entity';

@Injectable()
export class PolymarketWinnerRepository {
  constructor(
    @InjectRepository(PolymarketWinnerEntity)
    private readonly repo: Repository<PolymarketWinnerEntity>,
  ) {}

  async saveAll(winners: Partial<PolymarketWinnerEntity>[]): Promise<void> {
    await this.repo.save(winners);
  }

  async getRecentBySignal(signalKey: string): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({
      where: { signalKey },
      order: { positionSize: 'DESC' },
    });
  }

  async getRecent(limit = 100): Promise<PolymarketWinnerEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
