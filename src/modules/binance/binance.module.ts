import { Module } from '@nestjs/common';
import { BinanceWsService } from './binance-ws.service';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [BinanceWsService],
})
export class BinanceModule {}
