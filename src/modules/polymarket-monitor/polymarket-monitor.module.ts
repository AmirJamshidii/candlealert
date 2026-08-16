import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PolymarketMonitorService } from './polymarket-monitor.service';
import { ConfigModule } from '../../config/config.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ErrorLogModule } from '../error-log/error-log.module';

@Module({
  imports: [HttpModule, ConfigModule, TelegramModule, ErrorLogModule],
  providers: [PolymarketMonitorService],
})
export class PolymarketMonitorModule {}
