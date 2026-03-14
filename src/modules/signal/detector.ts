import { query } from '../../lib/db';
import { Candle, Alert, SignalResult } from '../../types';
import { logger } from '../../lib/logger';

const MODULE = 'signal';
const SIGNAL_TYPE = '4_green_candles';
const REQUIRED_GREEN_COUNT = 4;

export class SignalDetector {
  /**
   * Checks if the last N closed candles are all green (close > open).
   * Returns a signal result with a unique key derived from the close times.
   */
  detect(candles: Candle[]): SignalResult {
    if (candles.length < REQUIRED_GREEN_COUNT) {
      return { detected: false, signalKey: '', candles: [] };
    }

    const lastN = candles.slice(0, REQUIRED_GREEN_COUNT);
    const allGreen = lastN.every(c => c.close > c.open);

    if (!allGreen) {
      return { detected: false, signalKey: '', candles: [] };
    }

    const closeTimes = lastN.map(c => c.closeTime).sort((a, b) => a - b);
    const signalKey = `${lastN[0].symbol}:${lastN[0].interval}:${SIGNAL_TYPE}:${closeTimes.join(',')}`;

    return { detected: true, signalKey, candles: lastN };
  }

  async isAlertAlreadySent(signalKey: string, chatId: string): Promise<boolean> {
    const result = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM alerts WHERE signal_key = $1 AND telegram_chat_id = $2`,
      [signalKey, chatId]
    );
    return parseInt(result.rows[0].cnt, 10) > 0;
  }

  async recordAlert(alert: Alert): Promise<void> {
    await query(
      `INSERT INTO alerts (symbol, interval, signal_type, signal_key, last_candle_close_time, telegram_chat_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (signal_key, telegram_chat_id) DO NOTHING`,
      [alert.symbol, alert.interval, alert.signalType, alert.signalKey, alert.lastCandleCloseTime, alert.telegramChatId]
    );
    logger.info(`Alert recorded: ${alert.signalKey}`, { module: MODULE, symbol: alert.symbol });
  }

  getSignalType(): string {
    return SIGNAL_TYPE;
  }
}
