import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Database
  DB_HOST: Joi.string().default('postgres'),
  DB_PORT: Joi.number().integer().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),

  // Binance
  BINANCE_WS_URL: Joi.string().default('wss://stream.binance.com:9443'),
  BINANCE_BASE_URL: Joi.string().default('https://api.binance.com'),

  // Intervals
  INTERVAL: Joi.string().default('5m,15m,1h'),

  // Telegram
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_CHAT_ID: Joi.string().required(),

  // Polymarket
  POLYMARKET_GAMMA_URL: Joi.string().default(
    'https://gamma-api.polymarket.com',
  ),
  POLYMARKET_DATA_URL: Joi.string().default('https://data-api.polymarket.com'),
  POLYMARKET_WINNER_COUNT: Joi.number().integer().min(1).max(50).default(10),

  // Signal
  SNAPSHOT_WINDOW_MS: Joi.number().integer().min(1000).default(10000),

  // Testing
  SIGNAL_TEST_MODE: Joi.boolean().default(false),

  // App
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('production'),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
});
