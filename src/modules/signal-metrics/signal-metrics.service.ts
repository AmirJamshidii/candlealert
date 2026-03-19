import { Injectable, Logger } from '@nestjs/common';
import { ReversalSignalEvent } from '../../events/reversal-signal.event';
import { SignalMetricsRepository } from './signal-metrics.repository';

@Injectable()
export class SignalMetricsService {
  private readonly logger = new Logger(SignalMetricsService.name);

  constructor(private readonly repo: SignalMetricsRepository) {}

  async record(event: ReversalSignalEvent): Promise<void> {
    const { signalKey, interval, candle, snapshotPrice, direction } = event;
    const { open, high, low, close, volume, openTime, closeTime } = candle;

    const bodySize = Math.abs(close - open);
    const bodySizePct = (bodySize / open) * 100;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const rejectionWick = direction === 'green_to_red' ? upperWick : lowerWick;

    let snapshotDelta: number | null = null;
    let snapshotDeltaPct: number | null = null;
    let signalScore: number;

    if (snapshotPrice !== null) {
      snapshotDelta = close - snapshotPrice;
      snapshotDeltaPct = (snapshotDelta / snapshotPrice) * 100;
      const flipStrength = Math.min(Math.abs(snapshotDeltaPct) / 0.5, 1.0);
      const bodyStrength = Math.min(bodySizePct / 1.0, 1.0);
      signalScore = Math.round((0.6 * flipStrength + 0.4 * bodyStrength) * 100);
    } else {
      // No snapshot available — score from body size only
      const bodyStrength = Math.min(bodySizePct / 1.0, 1.0);
      signalScore = Math.round(0.4 * bodyStrength * 100);
    }

    try {
      await this.repo.save({
        signalKey,
        interval,
        direction,
        open: String(open),
        high: String(high),
        low: String(low),
        close: String(close),
        volume: String(volume),
        candleOpenTime: String(openTime),
        candleCloseTime: String(closeTime),
        snapshotPrice: snapshotPrice !== null ? String(snapshotPrice) : null,
        snapshotDelta: snapshotDelta !== null ? String(snapshotDelta) : null,
        snapshotDeltaPct:
          snapshotDeltaPct !== null ? String(snapshotDeltaPct) : null,
        bodySize: String(bodySize),
        bodySizePct: String(bodySizePct),
        upperWick: String(upperWick),
        lowerWick: String(lowerWick),
        rejectionWick: String(rejectionWick),
        signalScore: String(signalScore),
      });
      this.logger.debug(
        `Signal metrics recorded for ${signalKey} (score=${signalScore})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to record signal metrics for ${signalKey}`,
        err,
      );
      throw err;
    }
  }
}
