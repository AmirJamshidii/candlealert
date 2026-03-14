import { logger } from './logger';

interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  module?: string;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, delayMs = 1000, module } = opts;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = i === attempts;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (isLast) {
        logger.error(`All ${attempts} retry attempts failed`, { module, data: errMsg });
        throw err;
      }

      logger.warn(`Attempt ${i}/${attempts} failed, retrying in ${delayMs}ms`, { module, data: errMsg });
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  throw new Error('Retry logic error');
}
