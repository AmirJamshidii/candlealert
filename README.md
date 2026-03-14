# Amir Bot

Binance candle monitor with Telegram alerts. Watches configured trading pairs for patterns of 4 consecutive green candles and sends alerts via Telegram.

## Architecture

Single Node.js + TypeScript service with PostgreSQL storage. Polls Binance every minute, stores candle data, detects signals, and sends alerts.

### Modules

| Module | Purpose |
|---|---|
| `config` | Environment variable loading and validation |
| `lib/db` | PostgreSQL connection pool management |
| `lib/logger` | Structured console logging |
| `lib/retry` | Generic async retry helper |
| `lib/error-handler` | Centralized error handling with Telegram reporting |
| `modules/binance` | Binance REST API client for kline data |
| `modules/candle` | Candle data persistence layer |
| `modules/signal` | Pattern detection (4 green candles) |
| `modules/telegram` | Telegram Bot API message sender |
| `modules/scheduler` | Cron-based polling orchestrator |
| `modules/health` | HTTP health check endpoint |

## Prerequisites

- Docker and Docker Compose
- A Telegram bot token (create via [@BotFather](https://t.me/BotFather))
- Your Telegram chat ID

## Quick Start

1. **Clone and configure:**

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```
DATABASE_URL=postgresql://amir:amir_secret@postgres:5432/amirbot
BINANCE_BASE_URL=https://api.binance.com
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
SYMBOLS=BTCUSDT,ETHUSDT
INTERVAL=1m
POLL_CRON=* * * * *
HEALTH_PORT=3000
```

2. **Start:**

```bash
docker compose up -d --build
```

3. **Check logs:**

```bash
docker compose logs -f app
```

4. **Health check:**

```bash
curl http://localhost:3000
```

5. **Stop:**

```bash
docker compose down
```

## How It Works

1. Every minute, the scheduler triggers a poll cycle.
2. For each configured symbol, the app fetches the last 10 candles from Binance.
3. Only closed candles are stored in PostgreSQL (upserted to avoid duplicates).
4. The last 4 closed candles are checked: if all have `close > open`, a signal is detected.
5. A unique `signal_key` is generated from the candle close times.
6. If no alert has been sent for that key, a Telegram message is sent and the alert is recorded.

## Error Handling

- Every async operation is wrapped in try/catch
- Errors are logged, stored in `error_logs`, and reported to Telegram
- Rate limiting prevents Telegram error-notification loops
- Per-symbol failures don't affect other symbols
- Global `uncaughtException` and `unhandledRejection` handlers keep the app alive
- The app container is configured with `restart: unless-stopped`

## Database Schema

- **symbols** — tracked trading pairs
- **candles** — historical kline data with unique constraint on `(symbol, interval, close_time)`
- **alerts** — sent alert records with unique constraint on `(signal_key, telegram_chat_id)`
- **error_logs** — application error history
