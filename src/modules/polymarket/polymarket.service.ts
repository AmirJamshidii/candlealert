import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import { PolymarketWinnerRepository } from './polymarket-winner.repository';
import { IWinner } from '../telegram/telegram-message.factory';
import { ErrorLogService } from '../error-log/error-log.service';

interface PolymarketMarket {
  id: string;
  question: string;
  active: boolean;
  closed: boolean;
  tokens: Array<{ token_id: string; outcome: string }>;
  outcomePrices: string[];
}

interface PolymarketTrade {
  maker_address: string;
  size: string;
  side: string;
  outcome_index: number;
}

@Injectable()
export class PolymarketService {
  private readonly logger = new Logger(PolymarketService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
    private readonly winnerRepo: PolymarketWinnerRepository,
    private readonly errorLogService: ErrorLogService,
  ) {}

  async handleSignal(
    signalKey: string,
    interval: string,
    closePrice: number,
    closeTime: number,
  ): Promise<IWinner[]> {
    try {
      const market = await this.findBtcMarket(closePrice);
      if (!market) {
        this.logger.warn('No matching BTC Polymarket market found');
        return [];
      }

      // Red candle = price dropped = "No / lower" outcome wins (index 1 or "No" side)
      const winningOutcome = this.determineWinningOutcome(market);
      const winners = await this.getTopWinners(market, winningOutcome, signalKey, interval, closeTime);
      return winners;
    } catch (err) {
      this.errorLogService.log(err, { module: 'polymarket' });
      return [];
    }
  }

  private async findBtcMarket(closePrice: number): Promise<PolymarketMarket | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.appConfig.polymarketGammaUrl}/markets`, {
          params: { closed: false, active: true, tag: 'crypto', limit: 100 },
          timeout: 10_000,
        }),
      );

      const markets: PolymarketMarket[] = res.data?.data ?? res.data ?? [];

      // Find BTC price range markets — filter by question text containing BTC and price
      const btcMarkets = markets.filter(
        (m) =>
          !m.closed &&
          m.active &&
          (m.question.toUpperCase().includes('BTC') || m.question.toUpperCase().includes('BITCOIN')),
      );

      if (!btcMarkets.length) return null;

      // Prefer market whose question contains a price range around closePrice
      const priceStr = Math.round(closePrice / 1000) * 1000; // round to nearest 1k
      const match = btcMarkets.find((m) => m.question.includes(String(priceStr)));
      return match ?? btcMarkets[0];
    } catch (err) {
      this.logger.error('Failed to fetch Polymarket markets', err);
      return null;
    }
  }

  private determineWinningOutcome(market: PolymarketMarket): { tokenId: string; outcome: string } {
    // Red candle = price went down = "No" or "lower" outcome wins
    // Polymarket YES/NO: index 0 = Yes, index 1 = No
    const noToken = market.tokens?.find((t) => t.outcome.toUpperCase() === 'NO') ?? market.tokens?.[1];
    return {
      tokenId: noToken?.token_id ?? '',
      outcome: noToken?.outcome ?? 'No',
    };
  }

  private async getTopWinners(
    market: PolymarketMarket,
    winningOutcome: { tokenId: string; outcome: string },
    signalKey: string,
    interval: string,
    closeTime: number,
  ): Promise<IWinner[]> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.appConfig.polymarketBaseUrl}/trades`, {
          params: { market: market.id, limit: 500 },
          timeout: 10_000,
        }),
      );

      const trades: PolymarketTrade[] = res.data?.data ?? res.data ?? [];

      // Aggregate by address on the winning side
      const aggregated = new Map<string, number>();
      for (const trade of trades) {
        // Filter to winning outcome (No = side "sell" in CLOB, or by outcome_index)
        if (trade.side?.toUpperCase() !== 'BUY') continue;
        const current = aggregated.get(trade.maker_address) ?? 0;
        aggregated.set(trade.maker_address, current + parseFloat(trade.size ?? '0'));
      }

      const sorted = [...aggregated.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, this.appConfig.polymarketWinnerCount);

      // Store in DB
      const entities = sorted.map(([addr, size]) => ({
        signalKey,
        marketId: market.id,
        marketQuestion: market.question,
        walletAddress: addr,
        positionSize: String(size),
        outcomeSide: winningOutcome.outcome,
        candleInterval: interval,
        candleCloseTime: String(closeTime),
      }));

      if (entities.length > 0) {
        await this.winnerRepo.saveAll(entities);
      }

      return sorted.map(([addr, size]) => ({
        walletAddress: addr,
        positionSize: size,
        marketQuestion: market.question,
      }));
    } catch (err) {
      this.logger.error('Failed to fetch Polymarket trades', err);
      return [];
    }
  }
}
