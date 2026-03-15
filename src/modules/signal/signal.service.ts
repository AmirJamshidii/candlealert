import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KlineTickEvent } from '../../events/kline-tick.event';
import { ReversalDirection, ReversalSignalEvent } from '../../events/reversal-signal.event';
import { SignalStateService } from './signal-state.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class SignalService {
  private readonly logger = new Logger(SignalService.name);

  constructor(
    private readonly signalStateService: SignalStateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly appConfig: AppConfig,
  ) {}

  @OnEvent('kline.tick')
  handleKlineTick(event: KlineTickEvent): void {
    const { interval, candle } = event;
    const now = Date.now();
    const timeRemaining = candle.closeTime - now;

    // Snapshot at T-Ns if not done yet for this candle
    if (
      timeRemaining <= this.appConfig.snapshotWindowMs &&
      timeRemaining > 0 &&
      !this.signalStateService.hasSnapshot(interval, candle.openTime)
    ) {
      const isGreen = candle.close > candle.open;
      this.signalStateService.snapshot(interval, candle.openTime, isGreen, candle.close);
      this.logger.debug(
        `[${interval}] T-10s snapshot: candle ${isGreen ? 'GREEN' : 'RED'} at ${candle.close}`,
      );
    }

    // On candle close: check for reversal
    if (candle.isClosed) {
      const snapshot = this.signalStateService.get(interval, candle.openTime);
      const isCandleRed = candle.close < candle.open;
      const isCandleGreen = candle.close > candle.open;

      const isGreenToRed = snapshot?.wasGreen && isCandleRed;
      const isRedToGreen = snapshot && !snapshot.wasGreen && isCandleGreen;
      const isReversal = isGreenToRed || isRedToGreen;
      const isTestMode = this.appConfig.signalTestMode;

      if (isReversal || isTestMode) {
        const signalKey = `reversal:BTCUSDT:${interval}:${candle.closeTime}`;
        const direction: ReversalDirection = isCandleRed ? 'green_to_red' : 'red_to_green';
        this.logger.log(
          isTestMode && !isReversal
            ? `[${interval}] TEST MODE: forcing signal. Key: ${signalKey}`
            : isGreenToRed
              ? `[${interval}] REVERSAL detected! Was green at ${snapshot.closeAtSnapshot}, closed red at ${candle.close}. Key: ${signalKey}`
              : `[${interval}] REVERSAL detected! Was red at ${snapshot.closeAtSnapshot}, closed green at ${candle.close}. Key: ${signalKey}`,
        );
        const snapshotPrice = snapshot?.closeAtSnapshot ?? null;
        this.eventEmitter.emit('reversal.detected', new ReversalSignalEvent(signalKey, interval, candle, snapshotPrice, direction));
      }

      // Always clean up snapshot on close
      this.signalStateService.clear(interval, candle.openTime);
    }
  }
}
