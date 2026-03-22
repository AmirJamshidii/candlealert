import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ICandle } from '../../common/interfaces/candle.interface';
import { KlineTickEvent } from '../../events/kline-tick.event';

const MAX_CANDLES = 500;

@Injectable()
export class CandleBufferService {
  private readonly buffers = new Map<string, ICandle[]>();

  @OnEvent('kline.tick')
  handleKlineTick(event: KlineTickEvent): void {
    if (!event.candle.isClosed) return;
    const buf = this.buffers.get(event.interval) ?? [];
    buf.push(event.candle);
    if (buf.length > MAX_CANDLES) buf.shift();
    this.buffers.set(event.interval, buf);
  }

  getCandles(interval: string, limit: number): ICandle[] {
    const buf = this.buffers.get(interval) ?? [];
    return buf.slice(-limit);
  }

  getCandleByOpenTime(interval: string, openTime: number): ICandle | null {
    const buf = this.buffers.get(interval) ?? [];
    return buf.find((c) => c.openTime === openTime) ?? null;
  }
}
