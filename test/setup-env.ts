// Runs in each Jest worker before any modules are loaded.
// Sets test DB env vars so NestJS ConfigModule picks them up instead of the real .env values.
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'candlealert_test';
process.env.DB_USER = 'candlealert';
process.env.DB_PASS = 'secret';
process.env.TELEGRAM_BOT_TOKEN = 'test_token';
process.env.TELEGRAM_CHAT_ID = '123456789';
process.env.NODE_ENV = 'test';
process.env.SIGNAL_TEST_MODE = 'false';
process.env.PORT = '3001';
process.env.INTERVAL = '5m,15m,1h';
process.env.BINANCE_WS_URL = 'wss://localhost:9999';
process.env.POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com';
process.env.POLYMARKET_DATA_URL = 'https://data-api.polymarket.com';
process.env.POLYMARKET_WINNER_COUNT = '10';
process.env.SNAPSHOT_WINDOW_MS = '10000';
process.env.LOG_LEVEL = 'error';
