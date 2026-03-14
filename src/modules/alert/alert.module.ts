import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEntity } from './alert.entity';
import { AlertRepository } from './alert.repository';
import { AlertService } from './alert.service';
import { PolymarketModule } from '../polymarket/polymarket.module';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertEntity]),
    PolymarketModule,
    ConfigModule,
  ],
  providers: [AlertRepository, AlertService],
  exports: [AlertRepository],
})
export class AlertModule {}
