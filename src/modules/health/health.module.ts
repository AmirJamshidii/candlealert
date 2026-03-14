import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AlertModule } from '../alert/alert.module';
import { PolymarketModule } from '../polymarket/polymarket.module';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [AlertModule, PolymarketModule, ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
