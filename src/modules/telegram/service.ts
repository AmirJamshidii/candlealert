import { logger } from '../../lib/logger';
import { retry } from '../../lib/retry';

const MODULE = 'telegram';

export class TelegramService {
  private readonly apiUrl: string;

  constructor(
    private botToken: string,
    private defaultChatId: string
  ) {
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(text: string, chatId?: string): Promise<void> {
    const targetChat = chatId || this.defaultChatId;
    const url = `${this.apiUrl}/sendMessage`;

    await retry(
      async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChat,
            text,
            parse_mode: 'Markdown',
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Telegram API error: ${res.status} — ${body}`);
        }
      },
      { attempts: 2, delayMs: 1000, module: MODULE }
    );

    logger.info('Telegram message sent', { module: MODULE });
  }

  formatSignalAlert(data: {
    symbol: string;
    interval: string;
    pattern: string;
    closePrice: number;
    closeTime: number;
  }): string {
    const time = new Date(data.closeTime).toISOString();
    return [
      '🟢 *Signal Alert*',
      '',
      `*Symbol:* ${data.symbol}`,
      `*Interval:* ${data.interval}`,
      `*Pattern:* ${data.pattern}`,
      `*Last Close Price:* ${data.closePrice}`,
      `*Close Time:* ${time}`,
    ].join('\n');
  }

  createErrorSender(): (message: string) => Promise<void> {
    return async (message: string) => {
      await this.sendMessage(message);
    };
  }
}
