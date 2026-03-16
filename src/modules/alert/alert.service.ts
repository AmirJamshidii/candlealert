import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReversalSignalEvent } from '../../events/reversal-signal.event';
import { AlertRepository } from './alert.repository';
import { TelegramService } from '../telegram/telegram.service';
import { PolymarketService } from '../polymarket/polymarket.service';
import { AppConfig } from '../../config/app.config';
import { formatReversalAlert } from '../telegram/telegram-message.factory';
import { ErrorLogService } from '../error-log/error-log.service';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly alertRepo: AlertRepository,
    private readonly telegramService: TelegramService,
    private readonly polymarketService: PolymarketService,
    private readonly appConfig: AppConfig,
    private readonly errorLogService: ErrorLogService,
  ) {}

  @OnEvent('reversal.detected')
  async handleReversalDetected(event: ReversalSignalEvent): Promise<void> {
    const { signalKey, interval, candle, snapshotPrice, direction } = event;

    try {
      // Send initial alert immediately (without Polymarket data)
      const initialMessage = formatReversalAlert(candle, interval, [], snapshotPrice, this.appConfig.snapshotWindowMs, [], direction, true);

      const messageIds = new Map<string, number>();
      await Promise.all(
        this.appConfig.telegramChatIds.map(async (chatId) => {
          const isDuplicate = await this.alertRepo.isDuplicate(signalKey, chatId);
          if (isDuplicate) {
            this.logger.debug(`Duplicate alert skipped [${chatId}]: ${signalKey}`);
            return;
          }
          const msgId = await this.telegramService.sendMessage(initialMessage, chatId);
          if (msgId) messageIds.set(chatId, msgId);
          await this.alertRepo.record(signalKey, chatId, interval, candle.closeTime);
          this.logger.log(`Alert sent [${chatId}] for ${signalKey}`);
        }),
      );

      if (messageIds.size === 0) return;

      // Poll every 10s until Polymarket market is closed, then edit message with real data
      const MAX_POLL_MS = 2 * 60 * 60 * 1000; // 2 hours
      const startTime = Date.now();

      const poll = setInterval(() => {
        void (async () => {
          try {
            if (Date.now() - startTime > MAX_POLL_MS) {
              clearInterval(poll);
              this.logger.warn(`Polling timeout reached for ${signalKey}`);
              return;
            }

            const isClosed = await this.polymarketService.isMarketClosed(interval, candle.openTime);
            this.logger.debug(`Market closed check for ${signalKey}: ${isClosed}`);
            if (!isClosed) return;

            clearInterval(poll);

            const { holders, positions } = await this.polymarketService.handleSignal(
              signalKey,
              interval,
              candle.openTime,
              candle.closeTime,
              direction,
            );

            const updatedMessage = formatReversalAlert(candle, interval, holders, snapshotPrice, this.appConfig.snapshotWindowMs, positions, direction, false);

            await Promise.all(
              [...messageIds.entries()].map(([chatId, msgId]) =>
                this.telegramService.editMessage(updatedMessage, chatId, msgId),
              ),
            );
            this.logger.log(`Alert edited with Polymarket data for ${signalKey}`);
          } catch (err) {
            this.errorLogService.log(err, { module: 'alert-poll' });
          }
        })();
      }, 10_000);
    } catch (err) {
      this.errorLogService.log(err, { module: 'alert' });
    }
  }
}
