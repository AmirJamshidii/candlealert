# CLAUDE.md

## Purpose

**CandleAlert exists to identify suspected market manipulators.**

Manipulators move large amounts of BTC just before a candle closes to reverse its direction:
- **Dump BTC** → flips candle green→red → Polymarket "down" position holders win
- **Pump BTC** → flips candle red→green → Polymarket "up" position holders win

When a reversal signal fires, the app fetches Polymarket wallets holding positions on the **winning side** of that candle. Wallets with the **highest position share at signal time** are the prime suspects — they likely caused or anticipated the reversal.

The `polymarket_winners` table and winner rankings in Telegram alerts are the **most important output** of this system. All other logic (candle monitoring, reversal detection, dedup) exists to serve this goal.

## Commands

```bash
# Development (hot-reload, no Docker rebuild)
npm run dev             # Start postgres in Docker + app in watch mode
npm run dev:infra:down  # Stop dev postgres

# Production
npm run docker:up       # Build and run all services (app + postgres)
npm run docker:down     # Stop services

# Other
npm run build           # Compile TypeScript
npm run test            # Unit tests
npx jest path/to/file   # Single test
npm run lint            # ESLint auto-fix
```

## Architecture

**CandleAlert** monitors BTC/USDT candles on Binance, detects **green→red and red→green** reversal signals, fetches Polymarket positions on the winning side, and sends Telegram alerts.

**Signal flow**: `BinanceWsService` → `kline.tick` → `SignalService` → `reversal.detected` → `AlertService` → `PolymarketService` + `TelegramService` + `AlertRepository`

**Key patterns:**
- Signal snapshot taken before candle close (configurable via `SNAPSHOT_WINDOW_MS`, default 10s); emits reversal if direction flips
- Both directions supported: `green_to_red` | `red_to_green`
- `SIGNAL_TEST_MODE=true` fires on every close (skips reversal logic)
- Dedup via unique `(signal_key, chat_id)` constraint; signal key: `reversal:BTCUSDT:${interval}:${closeTime}`
- Polymarket slug: `btc-updown-${interval}-${Math.floor(openTime/1000)}`

## Modules

| Module | Responsibility |
|--------|----------------|
| `binance` | WebSocket kline stream; exponential backoff reconnect |
| `signal` | Reversal detection (both directions) + in-memory snapshots |
| `alert` | Alert orchestration |
| `polymarket` | Fetches winning-side position holders via Gamma + Data APIs; caches wallet profiles |
| `telegram` | HTML-formatted messages to multiple chat IDs |
| `analytics` | REST analytics: signal stats, winner leaderboards, holder history, BTC candle data with signal markers |
| `health` | REST: `/api/health`, `/api/config`, `/api/alerts`, `/api/winners` |
| `error-log` | Captures errors from all modules to `error_logs` table |
| `config` | `AppConfig` service validated via Joi |
| `database` | TypeORM + PostgreSQL; SnakeNamingStrategy; auto-migrations |

## Analytics Endpoints (`/api/analytics/*`)

- `GET /signals/summary` — alert count grouped by interval
- `GET /signals/count` — total signal count (optional `since` timestamp)
- `GET /signals/timeline` — daily signal counts for last N days
- `GET /signals/heatmap` — signal count grouped by hour of day (UTC)
- `GET /signals/directions` — signal count by direction per interval
- `GET /signals/:signalKey/candle` — OHLCV data for a specific signal
- `GET /winners/leaderboard` — top wallets by cumulative position size
- `GET /winners/by-signal/:signalKey` — winners for one specific signal
- `GET /holders/count` — count of distinct holder wallets (optional `since`)
- `GET /holders/leaderboard` — top holders by appearances + total position
- `GET /holders/:walletAddress` — full win history for one wallet
- `GET /btc/candles` — recent BTC/USDT candlestick data with signal markers
- `GET /wallets/leaderboard` — top wallets by avg PnL across signals
- `GET /wallets/:address/profile` — Polymarket portfolio profile for a wallet
- `GET /errors` — error logs with optional module filter

## Config (`.env`)

- `DB_HOST/PORT/NAME/USER/PASS` — PostgreSQL
- `INTERVAL` — comma-separated (e.g. `5m,15m,1h`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — comma-separated chat IDs
- `SIGNAL_TEST_MODE=true` — test mode
- `SNAPSHOT_WINDOW_MS` — ms before candle close for snapshot (default 10000)
- `POLYMARKET_WINNER_COUNT` — max top winners per signal (1–50, default 10)
- `PORT` — app server port (default 3000)
- `NODE_ENV` — `development` | `production` | `test`
- `LOG_LEVEL` — `debug` | `info` | `warn` | `error`
- `BINANCE_WS_URL`, `BINANCE_BASE_URL`, `POLYMARKET_GAMMA_URL`, `POLYMARKET_DATA_URL`

Tables: `alerts` (+ `direction`), `polymarket_winners` (+ `position_rank`, `avg_price`, `total_pnl`, `market_resolved_outcome`, `display_name`), `wallet_profiles`, `error_logs`. Schema also in `/sql/init.sql`.
