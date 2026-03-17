import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolymarketService } from './polymarket.service';
import { PolymarketWinnerEntity } from './polymarket-winner.entity';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { WalletProfileEntity } from './wallet-profile.entity';
import { WalletProfileRepository } from './wallet-profile.repository';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PolymarketWinnerEntity, WalletProfileEntity]),
    ConfigModule,
  ],
  providers: [PolymarketService, PolymarketWinnerRepository, WalletProfileRepository],
  exports: [PolymarketService, PolymarketWinnerRepository, WalletProfileRepository],
})
export class PolymarketModule {}
