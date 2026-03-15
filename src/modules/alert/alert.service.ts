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
      // Fetch Polymarket winners for this signal
      const { holders, positions } = await this.polymarketService.handleSignal(
        signalKey,
        interval,
        candle.openTime,
        candle.closeTime,
        direction,
      );

      const message = formatReversalAlert(candle, interval, holders, snapshotPrice, this.appConfig.snapshotWindowMs, positions, direction);

      // Send to each chat ID (with dedup)
      await Promise.all(
        this.appConfig.telegramChatIds.map(async (chatId) => {
          const isDuplicate = await this.alertRepo.isDuplicate(signalKey, chatId);
          if (isDuplicate) {
            this.logger.debug(`Duplicate alert skipped [${chatId}]: ${signalKey}`);
            return;
          }
          await this.telegramService.sendMessage(message, chatId);
          await this.alertRepo.record(signalKey, chatId, interval, candle.closeTime);
          this.logger.log(`Alert sent [${chatId}] for ${signalKey}`);
        }),
      );
    } catch (err) {
      this.errorLogService.log(err, { module: 'alert' });
    }
  }
}
