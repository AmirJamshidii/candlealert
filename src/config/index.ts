import { AppConfig } from '../types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const intervals = (process.env.INTERVAL || '1m')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const chatIds = requireEnv('TELEGRAM_CHAT_ID')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    binanceBaseUrl: requireEnv('BINANCE_BASE_URL'),
    telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    telegramChatIds: chatIds,
    symbols: requireEnv('SYMBOLS').split(',').map(s => s.trim().toUpperCase()),
    intervals,
    pollCron: process.env.POLL_CRON || '* * * * *',
    healthPort: parseInt(process.env.HEALTH_PORT || '3000', 10),
  };
}
