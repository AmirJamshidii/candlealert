import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../config/app.config';
import { TelegramService } from '../telegram/telegram.service';
import { ErrorLogService } from '../error-log/error-log.service';

const INTERVAL_MS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

const INTERVAL_LABEL: Record<string, string> = {
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
};

const THRESHOLD_60 = 0.60;
const THRESHOLD_70 = 0.70;
const POLL_MS = 10_000;
const MONITOR_BEFORE_MS = 60_000;

interface MonitorSession {
  sent60: boolean;
  sent70: boolean;
  pollTimer: NodeJS.Timeout | null;
}

interface MarketOdds {
  upPrice: number;   // Yes / Up outcome (0–1)
  downPrice: number; // No / Down outcome (0–1)
}

@Injectable()
export class PolymarketMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PolymarketMonitorService.name);
  private readonly scheduleTimers: NodeJS.Timeout[] = [];
  private readonly sessions = new Map<string, MonitorSession>();
  private destroyed = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly appConfig: AppConfig,
    private readonly telegramService: TelegramService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  onModuleInit(): void {
    for (const interval of this.appConfig.intervals) {
      if (!INTERVAL_MS[interval]) {
        this.logger.warn(`Unknown interval: ${interval}, skipping monitor`);
        continue;
      }
      this.scheduleNext(interval);
    }
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const t of this.scheduleTimers) clearTimeout(t);
    for (const s of this.sessions.values()) {
      if (s.pollTimer) clearInterval(s.pollTimer);
    }
  }

  private scheduleNext(interval: string): void {
    if (this.destroyed) return;

    const intervalMs = INTERVAL_MS[interval];
    const now = Date.now();
    const nextCandleOpen = Math.ceil((now + 1) / intervalMs) * intervalMs;
    const monitorStartAt = nextCandleOpen - MONITOR_BEFORE_MS;
    const delay = Math.max(0, monitorStartAt - now);

    this.logger.log(
      `[${interval}] Next candle at ${new Date(nextCandleOpen).toISOString()}, monitoring starts in ${Math.round(delay / 1000)}s`,
    );

    const t = setTimeout(() => {
      this.startMonitoring(interval, nextCandleOpen);
      // Schedule the one after that
      const t2 = setTimeout(() => this.scheduleNext(interval), intervalMs);
      this.scheduleTimers.push(t2);
    }, delay);
    this.scheduleTimers.push(t);
  }

  private startMonitoring(interval: string, candleOpenTime: number): void {
    if (this.destroyed) return;

    const sessionKey = `${interval}:${candleOpenTime}`;
    const session: MonitorSession = { sent60: false, sent70: false, pollTimer: null };
    this.sessions.set(sessionKey, session);

    this.logger.log(
      `[${interval}] Monitoring started for candle opening at ${new Date(candleOpenTime).toISOString()}`,
    );

    const poll = setInterval(() => {
      void this.poll(interval, candleOpenTime, session, sessionKey);
    }, POLL_MS);

    session.pollTimer = poll;

    // Stop monitoring when the candle opens
    const msUntilOpen = candleOpenTime - Date.now();
    const stopTimer = setTimeout(() => {
      this.stopSession(session, sessionKey, interval, 'candle opened');
    }, Math.max(0, msUntilOpen));
    this.scheduleTimers.push(stopTimer);

    // Poll immediately
    void this.poll(interval, candleOpenTime, session, sessionKey);
  }

  private stopSession(session: MonitorSession, sessionKey: string, interval: string, reason: string): void {
    if (session.pollTimer) {
      clearInterval(session.pollTimer);
      session.pollTimer = null;
    }
    this.sessions.delete(sessionKey);
    this.logger.log(`[${interval}] Monitoring stopped (${reason})`);
  }

  private async poll(
    interval: string,
    candleOpenTime: number,
    session: MonitorSession,
    sessionKey: string,
  ): Promise<void> {
    if (session.sent70) return;

    try {
      const odds = await this.getMarketOdds(interval, candleOpenTime);
      if (!odds) return;

      const { upPrice, downPrice } = odds;
      this.logger.debug(
        `[${interval}] Odds — Up(Yes): ${(upPrice * 100).toFixed(1)}% | Down(No): ${(downPrice * 100).toFixed(1)}%`,
      );

      // Check each outcome for thresholds
      const outcomes: Array<{ label: 'YES' | 'NO'; price: number }> = [
        { label: 'YES', price: upPrice },
        { label: 'NO', price: downPrice },
      ];

      for (const { label, price } of outcomes) {
        if (!session.sent60 && price >= THRESHOLD_60) {
          session.sent60 = true;
          await this.sendAlert(interval, candleOpenTime, label, price, 60);
        }
        if (!session.sent70 && price >= THRESHOLD_70) {
          session.sent70 = true;
          await this.sendAlert(interval, candleOpenTime, label, price, 70);
          this.stopSession(session, sessionKey, interval, '70% threshold reached');
          return;
        }
      }
    } catch (err) {
      this.errorLogService.log(err, { module: 'polymarket-monitor' });
    }
  }

  private async getMarketOdds(interval: string, candleOpenTime: number): Promise<MarketOdds | null> {
    const slug = `btc-updown-${interval}-${Math.floor(candleOpenTime / 1000)}`;
    const url = `${this.appConfig.polymarketGammaUrl}/events`;

    try {
      const res = await firstValueFrom(
        this.httpService.get(url, {
          params: { slug },
          timeout: 10_000,
        }),
      );

      const events: Array<{
        markets?: Array<{
          outcomePrices?: string;
          outcomes?: string;
          tokens?: Array<{ outcome: string; price: number }>;
        }>;
      }> = Array.isArray(res.data) ? res.data : [res.data];

      const market = events[0]?.markets?.[0];
      if (!market) return null;

      // Try tokens first (CLOB format)
      if (market.tokens?.length >= 2) {
        const up = market.tokens.find((t) =>
          t.outcome?.toLowerCase().includes('up') || t.outcome?.toLowerCase() === 'yes',
        );
        const down = market.tokens.find((t) =>
          t.outcome?.toLowerCase().includes('down') || t.outcome?.toLowerCase() === 'no',
        );
        if (up && down) {
          return { upPrice: up.price, downPrice: down.price };
        }
      }

      // Fallback: outcomePrices JSON string ["0.65", "0.35"]
      if (market.outcomePrices) {
        const prices: string[] = JSON.parse(market.outcomePrices as string);
        if (prices.length >= 2) {
          return {
            upPrice: parseFloat(prices[0]),
            downPrice: parseFloat(prices[1]),
          };
        }
      }

      return null;
    } catch (err) {
      this.logger.warn(`[${interval}] Failed to fetch odds for ${slug}: ${(err as Error).message}`);
      return null;
    }
  }

  private async sendAlert(
    interval: string,
    candleOpenTime: number,
    outcome: 'YES' | 'NO',
    price: number,
    threshold: 60 | 70,
  ): Promise<void> {
    const openTimeStr = new Date(candleOpenTime).toUTCString().replace(' GMT', ' UTC');
    const pct = (price * 100).toFixed(1);
    const emoji = threshold === 70 ? '🚨' : '⚠️';
    const outcomeEmoji = outcome === 'YES' ? '📈' : '📉';

    const message = [
      `${emoji} <b>Polymarket Alert — ${INTERVAL_LABEL[interval] ?? interval} Candle</b>`,
      ``,
      `${outcomeEmoji} <b>${outcome}</b> reached <b>${pct}%</b> (threshold ${threshold}%)`,
      `🕐 Candle opens: <code>${openTimeStr}</code>`,
      `🔗 <a href="https://polymarket.com/event/btc-updown-${interval}-${Math.floor(candleOpenTime / 1000)}">View on Polymarket</a>`,
    ].join('\n');

    await Promise.all(
      this.appConfig.telegramChatIds.map((chatId) =>
        this.telegramService.sendMessage(message, chatId),
      ),
    );

    this.logger.log(
      `[${interval}] Alert sent: ${outcome} at ${pct}% (threshold ${threshold}%)`,
    );
  }
}
