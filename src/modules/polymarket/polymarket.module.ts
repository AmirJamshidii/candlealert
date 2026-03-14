import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolymarketService } from './polymarket.service';
import { PolymarketWinnerEntity } from './polymarket-winner.entity';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PolymarketWinnerEntity]),
    ConfigModule,
  ],
  providers: [PolymarketService, PolymarketWinnerRepository],
  exports: [PolymarketService, PolymarketWinnerRepository],
})
export class PolymarketModule {}
