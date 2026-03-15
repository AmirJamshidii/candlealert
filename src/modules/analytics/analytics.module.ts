import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { PolymarketModule } from '../polymarket/polymarket.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AlertModule, PolymarketModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
