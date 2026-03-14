import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;

  constructor(private readonly appConfig: AppConfig) {
    this.baseUrl = `https://api.telegram.org/bot${appConfig.telegramBotToken}`;
  }

  async sendMessage(text: string, chatId: string): Promise<void> {
    const url = `${this.baseUrl}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Telegram sendMessage failed [${chatId}]: ${body}`);
      }
    } catch (err) {
      this.logger.error(`Telegram sendMessage threw: ${err instanceof Error ? err.message : err}`);
    }
  }

  async sendToAll(text: string): Promise<void> {
    await Promise.all(this.appConfig.telegramChatIds.map(id => this.sendMessage(text, id)));
  }
}
