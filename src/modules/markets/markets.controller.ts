import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';

const ALLOWED_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT']);
const ALLOWED_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);

@Controller('api/markets')
export class MarketsController {
  constructor(
    private readonly http: HttpService,
    private readonly appConfig: AppConfig,
  ) {}

  /** Proxies Binance klines (avoids browser CORS on public API). */
  @Get('klines')
  async getKlines(
    @Query('symbol') symbol: string,
    @Query('interval') interval: string,
    @Query('limit') limitRaw?: string,
    @Query('endTime') endTimeRaw?: string,
  ): Promise<{
    symbol: string;
    interval: string;
    candles: { time: number; open: string; high: string; low: string; close: string }[];
  }> {
    const sym = (symbol || '').toUpperCase().trim();
    if (!ALLOWED_SYMBOLS.has(sym)) {
      throw new BadRequestException('symbol must be BTCUSDT or ETHUSDT');
    }
    const iv = (interval || '5m').toLowerCase().trim();
    if (!ALLOWED_INTERVALS.has(iv)) {
      throw new BadRequestException(`interval must be one of: ${[...ALLOWED_INTERVALS].join(', ')}`);
    }
    const parsed = parseInt(limitRaw ?? '500', 10);
    const limit = Number.isFinite(parsed) ? Math.min(1000, Math.max(1, parsed)) : 500;

    const url = `${this.appConfig.binanceBaseUrl}/api/v3/klines`;
    const params: Record<string, string | number> = { symbol: sym, interval: iv, limit };
    if (endTimeRaw !== undefined && endTimeRaw !== '') {
      const end = parseInt(endTimeRaw, 10);
      if (Number.isFinite(end)) params.endTime = end;
    }

    const { data } = await firstValueFrom(
      this.http.get<Array<[number, string, string, string, string]>>(url, { params }),
    );

    const candles = data.map((row) => ({
      time: Math.floor(row[0] / 1000),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
    }));

    return { symbol: sym, interval: iv, candles };
  }
}
