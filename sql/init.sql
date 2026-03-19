-- CandleAlert initial schema
-- This file runs only once on first postgres container startup.
-- TypeORM migrations handle subsequent schema changes.

CREATE TABLE IF NOT EXISTS error_logs (
  id         SERIAL PRIMARY KEY,
  module     VARCHAR(100),
  message    TEXT NOT NULL,
  stack      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at);

CREATE TABLE IF NOT EXISTS alerts (
  id                SERIAL PRIMARY KEY,
  signal_key        VARCHAR(255) NOT NULL,
  chat_id           VARCHAR(50)  NOT NULL,
  interval          VARCHAR(10)  NOT NULL,
  candle_close_time BIGINT       NOT NULL,
  direction         VARCHAR(20),
  polymarket_url    VARCHAR(500),
  sent_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (signal_key, chat_id)
);

CREATE TABLE IF NOT EXISTS polymarket_winners (
  id                      SERIAL PRIMARY KEY,
  signal_key              VARCHAR(255)   NOT NULL,
  market_id               VARCHAR(255)   NOT NULL,
  market_question         TEXT           NOT NULL,
  wallet_address          VARCHAR(42)    NOT NULL,
  position_size           NUMERIC(20, 6) NOT NULL,
  outcome_side            VARCHAR(20)    NOT NULL,
  candle_interval         VARCHAR(10)    NOT NULL,
  candle_close_time       BIGINT         NOT NULL,
  position_rank           INT,
  avg_price               NUMERIC(20, 6),
  total_pnl               NUMERIC(20, 6),
  market_resolved_outcome VARCHAR(20),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pw_signal_key     ON polymarket_winners (signal_key);
CREATE INDEX IF NOT EXISTS idx_pw_wallet_address ON polymarket_winners (wallet_address);

CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet_address          VARCHAR(42)    PRIMARY KEY,
  total_positions         INT            NOT NULL DEFAULT 0,
  total_current_value     NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_realized_pnl      NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_cash_pnl          NUMERIC(20, 6) NOT NULL DEFAULT 0,
  btc_updown_positions    INT            NOT NULL DEFAULT 0,
  favorite_categories     JSONB          NOT NULL DEFAULT '[]',
  suspect_score           NUMERIC(5, 2),
  win_rate                NUMERIC(5, 2),
  signal_count            INT,
  total_wagered           NUMERIC(20, 6),
  fetched_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_metrics (
  signal_key          VARCHAR(255)    PRIMARY KEY,
  interval            VARCHAR(10)     NOT NULL,
  direction           VARCHAR(20)     NOT NULL,
  open                NUMERIC(20, 8)  NOT NULL,
  high                NUMERIC(20, 8)  NOT NULL,
  low                 NUMERIC(20, 8)  NOT NULL,
  close               NUMERIC(20, 8)  NOT NULL,
  volume              NUMERIC(20, 8)  NOT NULL,
  candle_open_time    BIGINT          NOT NULL,
  candle_close_time   BIGINT          NOT NULL,
  snapshot_price      NUMERIC(20, 8),
  snapshot_delta      NUMERIC(20, 8),
  snapshot_delta_pct  NUMERIC(10, 6),
  body_size           NUMERIC(20, 8)  NOT NULL,
  body_size_pct       NUMERIC(10, 6)  NOT NULL,
  upper_wick          NUMERIC(20, 8)  NOT NULL,
  lower_wick          NUMERIC(20, 8)  NOT NULL,
  rejection_wick      NUMERIC(20, 8)  NOT NULL,
  signal_score        NUMERIC(5, 2)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sm_interval     ON signal_metrics (interval);
CREATE INDEX IF NOT EXISTS idx_sm_signal_score ON signal_metrics (signal_score DESC);
CREATE INDEX IF NOT EXISTS idx_sm_created_at   ON signal_metrics (created_at);

CREATE TABLE IF NOT EXISTS migrations (
  id         SERIAL PRIMARY KEY,
  timestamp  BIGINT       NOT NULL,
  name       VARCHAR(255) NOT NULL
);
