# CLAUDE.md

## Commands

```bash
npm run start:dev       # Watch mode
npm run build           # Compile TypeScript
npm run test            # Unit tests
npx jest path/to/file   # Single test
npm run lint            # ESLint auto-fix
npm run docker:up       # Build and run all services
npm run docker:down     # Stop services
```

## Architecture

**CandleAlert** monitors BTC/USDT candles on Binance, detects green→red reversal signals, fetches Polymarket positions, and sends Telegram alerts.

**Signal flow**: `BinanceWsService` → `kline.tick` → `SignalService` → `reversal.detected` → `AlertService` → `PolymarketService` + `TelegramService` + `AlertRepository`

**Key patterns:**
- Signal snapshot taken ~10s before candle close; emits reversal if green→red
- `SIGNAL_TEST_MODE=true` fires on every close (skips reversal logic)
- Dedup via unique `(signal_key, chat_id)` constraint; signal key: `${interval}:${openTime}`
- Polymarket slug: `btc-updown-${interval}-${Math.floor(openTime/1000)}`

## Modules

| Module | Responsibility |
|--------|----------------|
| `binance` | WebSocket kline stream; exponential backoff reconnect |
| `signal` | Reversal detection + in-memory snapshots |
| `alert` | Alert orchestration |
| `polymarket` | Fetches down-position holders via Gamma + Data APIs |
| `telegram` | HTML-formatted messages to multiple chat IDs |
| `health` | REST: `/api/health`, `/api/config`, `/api/alerts`, `/api/winners` |
| `config` | `AppConfig` service validated via Joi |
| `database` | TypeORM + PostgreSQL; SnakeNamingStrategy; auto-migrations |

## Config (`.env`)

- `DB_HOST/PORT/NAME/USER/PASS` — PostgreSQL
- `INTERVAL` — comma-separated (e.g. `5m,15m,1h`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — comma-separated chat IDs
- `SIGNAL_TEST_MODE=true` — test mode
- `BINANCE_WS_URL`, `BINANCE_BASE_URL`, `POLYMARKET_GAMMA_URL`, `POLYMARKET_DATA_URL`

Tables: `alerts`, `polymarket_winners`, `error_logs`. Schema also in `/sql/init.sql`.
