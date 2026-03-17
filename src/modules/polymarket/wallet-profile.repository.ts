import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletProfileEntity } from './wallet-profile.entity';

@Injectable()
export class WalletProfileRepository {
  constructor(
    @InjectRepository(WalletProfileEntity)
    private readonly repo: Repository<WalletProfileEntity>,
  ) {}

  async upsert(profile: Partial<WalletProfileEntity>): Promise<void> {
    await this.repo.save(profile);
  }

  async upsertMany(profiles: Partial<WalletProfileEntity>[]): Promise<void> {
    if (!profiles.length) return;
    await this.repo.save(profiles);
  }

  async findByAddress(walletAddress: string): Promise<WalletProfileEntity | null> {
    return this.repo.findOne({ where: { walletAddress } });
  }
}
