import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KlineTickEvent } from '../../events/kline-tick.event';
import { ICandle } from '../../common/interfaces/candle.interface';
import {
  ReversalDirection,
  ReversalSignalEvent,
} from '../../events/reversal-signal.event';
import { SignalStateService } from './signal-state.service';
import { AppConfig } from '../../config/app.config';
import { ChainlinkService } from '../chainlink/chainlink.service';

@Injectable()
export class SignalService {
  private readonly logger = new Logger(SignalService.name);

  constructor(
    private readonly signalStateService: SignalStateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly appConfig: AppConfig,
    private readonly chainlinkService: ChainlinkService,
  ) {}

  private readonly TWAP_WINDOW_MS = 30_000;

  @OnEvent('kline.tick')
  handleKlineTick(event: KlineTickEvent): void {
    const { interval, candle } = event;
    const now = Date.now();
    const timeRemaining = candle.closeTime - now;

    // Accumulate Binance price ticks for TWAP fallback
    if (!candle.isClosed) {
      this.signalStateService.addTick(interval, candle.openTime, candle.close);
    }

    // Snapshot at T-Ns if not done yet for this candle
    if (
      timeRemaining <= this.appConfig.snapshotWindowMs &&
      timeRemaining > 0 &&
      !this.signalStateService.hasSnapshot(interval, candle.openTime)
    ) {
      void this.takeSnapshot(interval, candle.openTime, candle.open, candle.close);
    }

    // On candle close: check for reversal
    if (candle.isClosed) {
      void this.checkReversal(interval, candle);
    }
  }

  private async takeSnapshot(
    interval: string,
    openTime: number,
    open: number,
    fallbackClose: number,
  ): Promise<void> {
    const chainlinkPrice = await this.chainlinkService.getBtcUsdPrice();
    const price =
      chainlinkPrice ??
      this.signalStateService.getTwap(interval, openTime, this.TWAP_WINDOW_MS) ??
      fallbackClose;
    const isGreen = price > open;
    this.signalStateService.snapshot(interval, openTime, isGreen, price);
    const source = chainlinkPrice ? 'Chainlink' : 'TWAP';
    this.logger.debug(
      `[${interval}] T-10s snapshot: candle ${isGreen ? 'GREEN' : 'RED'} (${source}=${price.toFixed(2)}, open=${open})`,
    );
  }

  private async checkReversal(
    interval: string,
    candle: ICandle,
  ): Promise<void> {
    const snapshot = this.signalStateService.get(interval, candle.openTime);

    const chainlinkPrice = await this.chainlinkService.getBtcUsdPrice();
    const price =
      chainlinkPrice ??
      this.signalStateService.getTwap(interval, candle.openTime, this.TWAP_WINDOW_MS) ??
      candle.close;

    const isCandleRed = price < candle.open;
    const isCandleGreen = price > candle.open;

    const isGreenToRed = snapshot?.wasGreen && isCandleRed;
    const isRedToGreen = snapshot && !snapshot.wasGreen && isCandleGreen;
    const isReversal = isGreenToRed || isRedToGreen;
    const isTestMode = this.appConfig.signalTestMode;

    if (isReversal || isTestMode) {
      const signalKey = `reversal:BTCUSDT:${interval}:${candle.closeTime}`;
      const direction: ReversalDirection = isCandleRed
        ? 'green_to_red'
        : 'red_to_green';
      const source = chainlinkPrice ? 'Chainlink' : 'TWAP';
      this.logger.log(
        isTestMode && !isReversal
          ? `[${interval}] TEST MODE: forcing signal. Key: ${signalKey}`
          : isGreenToRed
            ? `[${interval}] REVERSAL! ${source} was ${snapshot.closeAtSnapshot.toFixed(2)} (green), now ${price.toFixed(2)} (red). Key: ${signalKey}`
            : `[${interval}] REVERSAL! ${source} was ${snapshot.closeAtSnapshot.toFixed(2)} (red), now ${price.toFixed(2)} (green). Key: ${signalKey}`,
      );
      const snapshotPrice = snapshot?.closeAtSnapshot ?? null;
      this.eventEmitter.emit(
        'reversal.detected',
        new ReversalSignalEvent(signalKey, interval, candle, snapshotPrice, direction),
      );
    }

    this.signalStateService.clear(interval, candle.openTime);
  }
}
