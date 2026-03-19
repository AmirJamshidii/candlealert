import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignalMetrics1710000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS signal_metrics;`);
  }
}
