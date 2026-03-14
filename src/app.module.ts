import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ErrorLogModule } from './modules/error-log/error-log.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BinanceModule } from './modules/binance/binance.module';
import { SignalModule } from './modules/signal/signal.module';
import { PolymarketModule } from './modules/polymarket/polymarket.module';
import { AlertModule } from './modules/alert/alert.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
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
  ],
})
export class AppModule {}
