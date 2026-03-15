# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Watch mode
npm run build           # Compile TypeScript to dist/
npm run start:prod      # Run compiled output

# Testing
npm run test            # Unit tests
npm run test:watch      # Unit tests in watch mode
npm run test:cov        # Coverage report
npm run test:e2e        # E2E tests
npx jest path/to/file.spec.ts  # Single test file

# Linting
npm run lint            # ESLint with auto-fix

# Docker
npm run docker:up       # Build and run all services
npm run docker:detached # Run in background
npm run docker:down     # Stop all services
```

## Architecture

**CandleAlert** monitors BTC/USDT candles on Binance, detects green→red reversal signals, fetches related Polymarket betting positions, and sends Telegram alerts.

### Signal Flow

```
BinanceWsService → (kline.tick event) → SignalService → (reversal.detected event) → AlertService
                                                                                          ↓
                                                                              PolymarketService (fetch winners)
                                                                              TelegramService (send alert)
                                                                              AlertRepository (record in DB)
```

### Key Design Patterns

- **Event-driven**: NestJS EventEmitter connects Binance → Signal → Alert pipeline. Events: `kline.tick` and `reversal.detected`.
- **Signal detection**: `SignalService` takes a snapshot ~10s before candle close (when `closeTime - now < 10000ms`). If candle was green at snapshot and closes red, a reversal is emitted.
- **Test mode**: `SIGNAL_TEST_MODE=true` forces signal emission on every candle close, skipping reversal logic.
- **Deduplication**: Alerts table has a unique constraint on `(signal_key, chat_id)` to prevent duplicate Telegram messages.
- **Signal key format**: `${interval}:${openTime}` (e.g., `5m:1710000000000`)
- **Polymarket market slug**: `btc-updown-${interval}-${Math.floor(openTime/1000)}`

### Module Map

| Module | Responsibility |
|--------|---------------|
| `binance` | WebSocket to Binance kline stream; reconnects with exponential backoff |
| `signal` | Reversal detection; `SignalStateService` holds in-memory snapshots |
| `alert` | Orchestrates alert sending; listens for `reversal.detected` |
| `polymarket` | Fetches down-position holders from Polymarket Gamma + Data APIs |
| `telegram` | Sends HTML-formatted messages via Bot API to multiple chat IDs |
| `error-log` | Global module; logs errors to DB and console |
| `health` | REST endpoints: `/api/health`, `/api/config`, `/api/alerts`, `/api/winners` |
| `config` | Centralized `AppConfig` service; validated via Joi schema |
| `database` | TypeORM + PostgreSQL with SnakeNamingStrategy; auto-runs migrations |

### Configuration

All config is via `.env`. Key variables:
- `DB_HOST/PORT/NAME/USER/PASS` — PostgreSQL
- `INTERVAL` — comma-separated list (e.g., `5m,15m,1h`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — comma-separated chat IDs supported
- `SIGNAL_TEST_MODE=true` — bypasses reversal logic, fires on every close
- `BINANCE_WS_URL`, `BINANCE_BASE_URL`, `POLYMARKET_GAMMA_URL`, `POLYMARKET_DATA_URL`

### Database

PostgreSQL with TypeORM migrations. Tables: `alerts`, `polymarket_winners`, `error_logs`. The SQL schema is also in `/sql/init.sql`. SnakeNamingStrategy is applied globally, so TypeORM entity fields map to snake_case columns automatically.
