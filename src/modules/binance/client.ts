import { Candle, BinanceKline } from '../../types';
import { logger } from '../../lib/logger';
import { retry } from '../../lib/retry';

const MODULE = 'binance';

export class BinanceClient {
  constructor(private baseUrl: string) {}

  async fetchCandles(symbol: string, interval: string, limit: number = 10): Promise<Candle[]> {
    const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    const response = await retry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
        }
        return res;
      },
      { attempts: 3, delayMs: 2000, module: MODULE }
    );

    const data = (await response.json()) as BinanceKline[];

    logger.debug(`Fetched ${data.length} klines for ${symbol}`, { module: MODULE, symbol });

    return data.map((k) => ({
      symbol,
      interval,
      openTime: k[0],
      closeTime: k[6],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      isClosed: Date.now() > k[6],
    }));
  }

  getClosedCandles(candles: Candle[]): Candle[] {
    return candles.filter(c => c.isClosed);
  }
}
