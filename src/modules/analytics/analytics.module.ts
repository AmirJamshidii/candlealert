import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AlertModule } from '../alert/alert.module';
import { PolymarketModule } from '../polymarket/polymarket.module';
import { ConfigModule } from '../../config/config.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SignalMetricsModule } from '../signal-metrics/signal-metrics.module';

@Module({
  imports: [
    HttpModule,
    AlertModule,
    PolymarketModule,
    ConfigModule,
    SignalMetricsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // WalletProfileRepository is exported from PolymarketModule and injected via AnalyticsService
})
export class AnalyticsModule {}
