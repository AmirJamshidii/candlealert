import { Module } from '@nestjs/common';
import { BinanceWsService } from './binance-ws.service';
import { CandleBufferService } from './candle-buffer.service';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [BinanceWsService, CandleBufferService],
  exports: [CandleBufferService],
})
export class BinanceModule {}
