import cron from 'node-cron';
import { AppConfig } from '../../types';
import { BinanceClient } from '../binance/client';
import { CandleRepository } from '../candle/repository';
import { SignalDetector } from '../signal/detector';
import { TelegramService } from '../telegram/service';
import { logger } from '../../lib/logger';
import { handleError } from '../../lib/error-handler';

const MODULE = 'scheduler';

export class SchedulerRunner {
  private task: cron.ScheduledTask | null = null;

  constructor(
    private config: AppConfig,
    private binance: BinanceClient,
    private candleRepo: CandleRepository,
    private signalDetector: SignalDetector,
    private telegram: TelegramService
  ) {}

  start(): void {
    logger.info(`Starting scheduler with cron: ${this.config.pollCron}`, { module: MODULE });

    this.task = cron.schedule(this.config.pollCron, async () => {
      await this.runCycle();
    });

    logger.info('Scheduler started', { module: MODULE });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      logger.info('Scheduler stopped', { module: MODULE });
    }
  }

  async runCycle(): Promise<void> {
    const cycleStart = Date.now();
    logger.info('Starting poll cycle', { module: MODULE });

    for (const symbol of this.config.symbols) {
      for (const interval of this.config.intervals) {
        try {
          await this.processSymbolInterval(symbol, interval);
        } catch (err) {
          await handleError(err, { module: MODULE, symbol });
        }
      }
    }

    const elapsed = Date.now() - cycleStart;
    logger.info(`Poll cycle completed in ${elapsed}ms`, { module: MODULE });
  }

  private async processSymbolInterval(symbol: string, interval: string): Promise<void> {
    logger.debug(`Processing ${symbol} [${interval}]`, { module: MODULE, symbol });

    const candles = await this.binance.fetchCandles(symbol, interval, 10);

    const latestCandle = candles[candles.length - 1];
    if (latestCandle) {
      logger.info(
        `${symbol} [${interval}] price: ${latestCandle.close} (H: ${latestCandle.high} L: ${latestCandle.low} V: ${latestCandle.volume})`,
        { module: MODULE, symbol }
      );
    }

    const closedCandles = this.binance.getClosedCandles(candles);

    if (closedCandles.length === 0) {
      logger.warn(`No closed candles for ${symbol} [${interval}]`, { module: MODULE, symbol });
      return;
    }

    await this.candleRepo.upsertCandles(closedCandles);

    const storedCandles = await this.candleRepo.getLastClosedCandles(symbol, interval, 4);

    const signal = this.signalDetector.detect(storedCandles);

    if (!signal.detected) {
      logger.debug(`No signal for ${symbol} [${interval}]`, { module: MODULE, symbol });
      return;
    }

    const lastCandle = signal.candles[0];
    const message = this.telegram.formatSignalAlert({
      symbol,
      interval,
      pattern: '4 consecutive red candles',
      closePrice: lastCandle.close,
      closeTime: lastCandle.closeTime,
    });

    for (const chatId of this.config.telegramChatIds) {
      const alreadySent = await this.signalDetector.isAlertAlreadySent(
        signal.signalKey,
        chatId
      );

      if (alreadySent) {
        logger.debug(`Alert already sent for ${symbol} [${interval}] to ${chatId}`, { module: MODULE, symbol });
        continue;
      }

      try {
        await this.telegram.sendMessage(message, chatId);
      } catch (err) {
        await handleError(err, { module: 'telegram', symbol });
        continue;
      }

      await this.signalDetector.recordAlert({
        symbol,
        interval,
        signalType: this.signalDetector.getSignalType(),
        signalKey: signal.signalKey,
        lastCandleCloseTime: lastCandle.closeTime,
        telegramChatId: chatId,
      });

      logger.info(`Signal alert sent for ${symbol} [${interval}] to ${chatId}`, { module: MODULE, symbol });
    }
  }
}
