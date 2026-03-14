import { loadConfig } from './config';
import { initDb, closeDb } from './lib/db';
import { logger } from './lib/logger';
import { setupGlobalHandlers, registerTelegramErrorSender, handleError } from './lib/error-handler';
import { BinanceClient } from './modules/binance/client';
import { CandleRepository } from './modules/candle/repository';
import { SignalDetector } from './modules/signal/detector';
import { TelegramService } from './modules/telegram/service';
import { SchedulerRunner } from './modules/scheduler/runner';
import { startHealthServer } from './modules/health/server';
import http from 'http';

const MODULE = 'main';

async function main(): Promise<void> {
  logger.info('=== Amir Bot starting ===', { module: MODULE });

  const config = loadConfig();
  logger.info(`Symbols: ${config.symbols.join(', ')}`, { module: MODULE });
  logger.info(`Interval: ${config.interval}`, { module: MODULE });

  setupGlobalHandlers();

  initDb(config.databaseUrl);
  logger.info('Database pool initialized', { module: MODULE });

  const telegram = new TelegramService(config.telegramBotToken, config.telegramChatId);
  registerTelegramErrorSender(telegram.createErrorSender());
  logger.info('Telegram service initialized', { module: MODULE });

  const binance = new BinanceClient(config.binanceBaseUrl);
  const candleRepo = new CandleRepository();
  const signalDetector = new SignalDetector();

  const scheduler = new SchedulerRunner(config, binance, candleRepo, signalDetector, telegram);
  scheduler.start();

  const healthServer = startHealthServer(config.healthPort);

  await ensureSymbols(config.symbols, config.interval);

  try {
    await telegram.sendMessage(`✅ *Amir Bot started*\n\nSymbols: ${config.symbols.join(', ')}\nInterval: ${config.interval}`);
  } catch (err) {
    logger.warn('Could not send startup message to Telegram', { module: MODULE, data: err instanceof Error ? err.message : String(err) });
  }

  logger.info('=== Amir Bot is running ===', { module: MODULE });

  setupGracefulShutdown(scheduler, healthServer);
}

async function ensureSymbols(symbols: string[], interval: string): Promise<void> {
  const { query } = await import('./lib/db');
  for (const symbol of symbols) {
    try {
      await query(
        `INSERT INTO symbols (symbol, interval, is_active) VALUES ($1, $2, TRUE)
         ON CONFLICT (symbol, interval) DO UPDATE SET is_active = TRUE`,
        [symbol, interval]
      );
    } catch (err) {
      await handleError(err, { module: MODULE, symbol });
    }
  }
  logger.info('Symbols synced to database', { module: MODULE });
}

function setupGracefulShutdown(scheduler: SchedulerRunner, healthServer: http.Server): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`, { module: MODULE });
    scheduler.stop();
    healthServer.close();
    await closeDb();
    logger.info('Shutdown complete', { module: MODULE });
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(async (err) => {
  logger.error('Fatal startup error', { module: MODULE, data: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
