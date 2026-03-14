import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLogEntity } from './error-log.entity';

interface ErrorContext {
  module?: string;
}

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);
  private lastTelegramSentAt = 0;
  private readonly MIN_TELEGRAM_INTERVAL = 30_000;

  constructor(
    @InjectRepository(ErrorLogEntity)
    private readonly repo: Repository<ErrorLogEntity>,
  ) {}

  async log(err: unknown, ctx: ErrorContext = {}): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    this.logger.error(`[${ctx.module ?? 'app'}] ${message}`, stack);

    try {
      await this.repo.save({ module: ctx.module, message, stack });
    } catch {
      // Avoid recursive error logging
    }
  }
}
