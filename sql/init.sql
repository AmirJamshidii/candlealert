CREATE TABLE IF NOT EXISTS symbols (
    id          SERIAL PRIMARY KEY,
    symbol      VARCHAR(20) NOT NULL,
    interval    VARCHAR(5)  NOT NULL DEFAULT '1m',
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, interval)
);

CREATE TABLE IF NOT EXISTS candles (
    id          SERIAL PRIMARY KEY,
    symbol      VARCHAR(20)    NOT NULL,
    interval    VARCHAR(5)     NOT NULL,
    open_time   BIGINT         NOT NULL,
    close_time  BIGINT         NOT NULL,
    open        NUMERIC(20,8)  NOT NULL,
    high        NUMERIC(20,8)  NOT NULL,
    low         NUMERIC(20,8)  NOT NULL,
    close       NUMERIC(20,8)  NOT NULL,
    volume      NUMERIC(30,8)  NOT NULL,
    is_closed   BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, interval, close_time)
);

CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval_close_time
    ON candles (symbol, interval, close_time DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id                    SERIAL PRIMARY KEY,
    symbol                VARCHAR(20)  NOT NULL,
    interval              VARCHAR(5)   NOT NULL,
    signal_type           VARCHAR(50)  NOT NULL,
    signal_key            VARCHAR(255) NOT NULL,
    last_candle_close_time BIGINT      NOT NULL,
    telegram_chat_id      VARCHAR(50)  NOT NULL,
    sent_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (signal_key, telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_signal_key
    ON alerts (signal_key);

CREATE TABLE IF NOT EXISTS error_logs (
    id          SERIAL PRIMARY KEY,
    module      VARCHAR(100),
    symbol      VARCHAR(20),
    message     TEXT         NOT NULL,
    stack       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
    ON error_logs (created_at DESC);
