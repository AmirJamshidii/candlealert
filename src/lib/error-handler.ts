import { logger } from './logger';
import { query } from './db';

type TelegramErrorSender = (message: string) => Promise<void>;

let telegramSender: TelegramErrorSender | null = null;
let lastErrorTelegramSentAt = 0;
const MIN_ERROR_TELEGRAM_INTERVAL_MS = 10_000;

export function registerTelegramErrorSender(sender: TelegramErrorSender): void {
  telegramSender = sender;
}

export async function handleError(
  err: unknown,
  context: { module?: string; symbol?: string; critical?: boolean }
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error(message, { module: context.module, symbol: context.symbol, data: stack });

  try {
    await query(
      `INSERT INTO error_logs (module, symbol, message, stack) VALUES ($1, $2, $3, $4)`,
      [context.module || null, context.symbol || null, message, stack || null]
    );
  } catch (dbErr) {
    logger.error('Failed to log error to DB', { module: 'error-handler', data: dbErr instanceof Error ? dbErr.message : String(dbErr) });
  }

  await sendErrorToTelegram(message, context);
}

async function sendErrorToTelegram(
  message: string,
  context: { module?: string; symbol?: string }
): Promise<void> {
  if (!telegramSender) return;

  const now = Date.now();
  if (now - lastErrorTelegramSentAt < MIN_ERROR_TELEGRAM_INTERVAL_MS) {
    logger.warn('Skipping error Telegram notification (rate limited)', { module: 'error-handler' });
    return;
  }

  try {
    const lines = [
      '⚠️ *Error Alert*',
      '',
      `*Module:* ${context.module || 'unknown'}`,
    ];
    if (context.symbol) lines.push(`*Symbol:* ${context.symbol}`);
    lines.push(
      `*Message:* ${escapeMarkdown(message.substring(0, 500))}`,
      `*Time:* ${new Date().toISOString()}`
    );

    await telegramSender(lines.join('\n'));
    lastErrorTelegramSentAt = Date.now();
  } catch (sendErr) {
    logger.error('Failed to send error to Telegram', {
      module: 'error-handler',
      data: sendErr instanceof Error ? sendErr.message : String(sendErr),
    });
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export function setupGlobalHandlers(): void {
  process.on('uncaughtException', async (err) => {
    await handleError(err, { module: 'process', critical: true });
    logger.error('uncaughtException caught — app continues running', { module: 'process' });
  });

  process.on('unhandledRejection', async (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    await handleError(err, { module: 'process', critical: true });
    logger.error('unhandledRejection caught — app continues running', { module: 'process' });
  });
}
