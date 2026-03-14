import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
        sent_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (signal_key, chat_id)
      );

      CREATE TABLE IF NOT EXISTS polymarket_winners (
        id                 SERIAL PRIMARY KEY,
        signal_key         VARCHAR(255) NOT NULL,
        market_id          VARCHAR(255) NOT NULL,
        market_question    TEXT         NOT NULL,
        wallet_address     VARCHAR(42)  NOT NULL,
        position_size      NUMERIC(20, 6) NOT NULL,
        outcome_side       VARCHAR(20)  NOT NULL,
        candle_interval    VARCHAR(10)  NOT NULL,
        candle_close_time  BIGINT       NOT NULL,
        created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pw_signal_key     ON polymarket_winners (signal_key);
      CREATE INDEX IF NOT EXISTS idx_pw_wallet_address ON polymarket_winners (wallet_address);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS polymarket_winners;
      DROP TABLE IF EXISTS alerts;
      DROP TABLE IF EXISTS error_logs;
    `);
  }
}
