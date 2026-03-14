import { query } from '../../lib/db';
import { Candle, StoredCandle } from '../../types';
import { logger } from '../../lib/logger';

const MODULE = 'candle-repo';

export class CandleRepository {
  async upsertCandles(candles: Candle[]): Promise<number> {
    if (candles.length === 0) return 0;

    let inserted = 0;

    for (const c of candles) {
      const result = await query(
        `INSERT INTO candles (symbol, interval, open_time, close_time, open, high, low, close, volume, is_closed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (symbol, interval, close_time) DO NOTHING`,
        [c.symbol, c.interval, c.openTime, c.closeTime, c.open, c.high, c.low, c.close, c.volume, c.isClosed]
      );
      if (result.rowCount && result.rowCount > 0) inserted++;
    }

    if (inserted > 0) {
      logger.debug(`Inserted ${inserted} new candles for ${candles[0].symbol}`, { module: MODULE, symbol: candles[0].symbol });
    }

    return inserted;
  }

  async getLastClosedCandles(symbol: string, interval: string, limit: number): Promise<StoredCandle[]> {
    const result = await query<{
      id: number;
      symbol: string;
      interval: string;
      open_time: string;
      close_time: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      is_closed: boolean;
      created_at: Date;
    }>(
      `SELECT * FROM candles
       WHERE symbol = $1 AND interval = $2 AND is_closed = TRUE
       ORDER BY close_time DESC
       LIMIT $3`,
      [symbol, interval, limit]
    );

    return result.rows.map(r => ({
      id: r.id,
      symbol: r.symbol,
      interval: r.interval,
      openTime: Number(r.open_time),
      closeTime: Number(r.close_time),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
      isClosed: r.is_closed,
      createdAt: r.created_at,
    }));
  }
}
