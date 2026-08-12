import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TELEGRAM_PROMPT,
} from '../modules/ai/prompts.constants';

@Injectable()
export class AppConfig {
  constructor(private readonly configService: ConfigService) {}

  get dbHost(): string {
    return this.configService.get<string>('DB_HOST');
  }
  get dbPort(): number {
    return this.configService.get<number>('DB_PORT');
  }
  get dbName(): string {
    return this.configService.get<string>('DB_NAME');
  }
  get dbUser(): string {
    return this.configService.get<string>('DB_USER');
  }
  get dbPass(): string {
    return this.configService.get<string>('DB_PASS');
  }

  get binanceWsUrl(): string {
    return this.configService.get<string>('BINANCE_WS_URL');
  }
  get binanceBaseUrl(): string {
    return this.configService.get<string>('BINANCE_BASE_URL');
  }

  get intervals(): string[] {
    return this.configService
      .get<string>('INTERVAL')
      .split(',')
      .map((s) => s.trim().toLowerCase());
  }

  get telegramBotToken(): string {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN');
  }
  get telegramChatIds(): string[] {
    return this.configService
      .get<string>('TELEGRAM_CHAT_ID')
      .split(',')
      .map((s) => s.trim());
  }

  get polymarketGammaUrl(): string {
    return this.configService.get<string>('POLYMARKET_GAMMA_URL');
  }
  get polymarketDataUrl(): string {
    return this.configService.get<string>('POLYMARKET_DATA_URL');
  }
  get polymarketWinnerCount(): number {
    return this.configService.get<number>('POLYMARKET_WINNER_COUNT');
  }

  get snapshotWindowMs(): number {
    return this.configService.get<number>('SNAPSHOT_WINDOW_MS');
  }
  get signalTestMode(): boolean {
    return this.configService.get<boolean>('SIGNAL_TEST_MODE');
  }

  get ethereumRpcUrl(): string | undefined {
    return this.configService.get<string>('ETHEREUM_RPC_URL');
  }

  get port(): number {
    return this.configService.get<number>('PORT');
  }
  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV');
  }

  get systemPrompt(): string {
    return (
      this.configService.get<string>('SYSTEM_PROMPT') ?? DEFAULT_SYSTEM_PROMPT
    );
  }

  get telegramPrompt(): string {
    return (
      this.configService.get<string>('TELEGRAM_PROMPT') ??
      DEFAULT_TELEGRAM_PROMPT
    );
  }
}
