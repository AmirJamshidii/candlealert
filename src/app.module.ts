import { join } from 'path';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ErrorLogModule } from './modules/error-log/error-log.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BinanceModule } from './modules/binance/binance.module';
import { SignalModule } from './modules/signal/signal.module';
import { PolymarketModule } from './modules/polymarket/polymarket.module';
import { AlertModule } from './modules/alert/alert.module';
import { HealthModule } from './modules/health/health.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MarketsModule } from './modules/markets/markets.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      exclude: ['/api/(.*)'],
    }),
    EventEmitterModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    ErrorLogModule,
    TelegramModule,
    BinanceModule,
    SignalModule,
    PolymarketModule,
    AlertModule,
    HealthModule,
    AnalyticsModule,
    MarketsModule,
  ],
})
export class AppModule {}
