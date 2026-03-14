import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as WebSocket from 'ws';
import { AppConfig } from '../../config/app.config';
import { ErrorLogService } from '../error-log/error-log.service';
import { IBinanceKlineWsMessage, ICandle } from '../../common/interfaces/candle.interface';
import { KlineTickEvent } from '../../events/kline-tick.event';

@Injectable()
export class BinanceWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceWsService.name);
  private readonly sockets = new Map<string, WebSocket>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly BASE_DELAY = 1_000;
  private readonly MAX_DELAY = 60_000;
  private destroyed = false;

  constructor(
    private readonly appConfig: AppConfig,
    private readonly eventEmitter: EventEmitter2,
    private readonly errorLogService: ErrorLogService,
  ) {}

  onModuleInit(): void {
    for (const interval of this.appConfig.intervals) {
      this.connect(interval, 0);
    }
  }

  private connect(interval: string, attempt: number): void {
    if (this.destroyed) return;

    const url = `${this.appConfig.binanceWsUrl}/ws/btcusdt@kline_${interval}`;
    this.logger.log(`Connecting to Binance WS [${interval}] (attempt ${attempt}): ${url}`);

    const ws = new WebSocket(url);

    ws.on('open', () => {
      this.logger.log(`Binance WS connected [${interval}]`);
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg: IBinanceKlineWsMessage = JSON.parse(raw.toString());
        if (msg.e !== 'kline') return;
        const k = msg.k;
        const candle: ICandle = {
          symbol: 'BTCUSDT',
          interval,
          openTime: k.t,
          closeTime: k.T,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          isClosed: k.x,
        };
        this.eventEmitter.emit('kline.tick', new KlineTickEvent(interval, candle));
      } catch (err) {
        this.errorLogService.log(err, { module: 'binance-ws' });
      }
    });

    ws.on('ping', (data) => ws.pong(data));

    ws.on('close', (code) => {
      this.sockets.delete(interval);
      if (this.destroyed || code === 1000) return;
      const delay = Math.min(this.BASE_DELAY * Math.pow(2, attempt), this.MAX_DELAY);
      this.logger.warn(`Binance WS [${interval}] closed (code ${code}), reconnecting in ${delay}ms`);
      const timer = setTimeout(() => this.connect(interval, attempt + 1), delay);
      this.reconnectTimers.set(interval, timer);
    });

    ws.on('error', (err) => {
      this.errorLogService.log(err, { module: 'binance-ws' });
    });

    this.sockets.set(interval, ws);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    for (const [interval, ws] of this.sockets.entries()) {
      this.logger.log(`Closing Binance WS [${interval}]`);
      ws.close(1000);
    }
  }
}
