import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { AppConfig } from '../../config/app.config';

const ALLOWED_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT']);
const ALLOWED_INTERVALS = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1d',
]);
const BINANCE_KLINES_TIMEOUT_MS = 15_000;

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
    candles: {
      time: number;
      open: string;
      high: string;
      low: string;
      close: string;
    }[];
  }> {
    const sym = (symbol || '').toUpperCase().trim();
    if (!ALLOWED_SYMBOLS.has(sym)) {
      throw new BadRequestException('symbol must be BTCUSDT or ETHUSDT');
    }
    const iv = (interval || '5m').toLowerCase().trim();
    if (!ALLOWED_INTERVALS.has(iv)) {
      throw new BadRequestException(
        `interval must be one of: ${[...ALLOWED_INTERVALS].join(', ')}`,
      );
    }
    const parsed = parseInt(limitRaw ?? '500', 10);
    const limit = Number.isFinite(parsed)
      ? Math.min(1000, Math.max(1, parsed))
      : 500;

    const url = `${this.appConfig.binanceBaseUrl}/api/v3/klines`;
    const params: Record<string, string | number> = {
      symbol: sym,
      interval: iv,
      limit,
    };
    if (endTimeRaw !== undefined && endTimeRaw !== '') {
      const end = parseInt(endTimeRaw, 10);
      if (Number.isFinite(end)) params.endTime = end;
    }

    try {
      const { data } = await firstValueFrom(
        this.http.get<unknown>(url, {
          params,
          timeout: BINANCE_KLINES_TIMEOUT_MS,
        }),
      );

      if (!Array.isArray(data)) {
        throw new BadGatewayException(
          'Binance klines response was not an array',
        );
      }

      const candles = data.map((row: unknown, index: number) => {
        if (!Array.isArray(row) || row.length < 5) {
          throw new BadGatewayException(
            `Invalid kline row at index ${index} from Binance`,
          );
        }
        return {
          time: Math.floor(Number(row[0]) / 1000),
          open: String(row[1]),
          high: String(row[2]),
          low: String(row[3]),
          close: String(row[4]),
        };
      });

      return { symbol: sym, interval: iv, candles };
    } catch (err: unknown) {
      if (
        err instanceof BadGatewayException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      let message = 'Binance klines request failed';
      if (isAxiosError(err)) {
        const body = err.response?.data as { msg?: string } | undefined;
        message = body?.msg ?? err.message ?? message;
        if (err.code === 'ECONNABORTED') {
          message = `Binance klines timed out after ${BINANCE_KLINES_TIMEOUT_MS}ms`;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      throw new BadGatewayException(message);
    }
  }
}
