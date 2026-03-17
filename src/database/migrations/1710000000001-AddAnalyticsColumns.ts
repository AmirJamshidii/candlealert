import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalyticsColumns1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE alerts
        ADD COLUMN IF NOT EXISTS direction VARCHAR(20);

      ALTER TABLE polymarket_winners
        ADD COLUMN IF NOT EXISTS position_rank INT,
        ADD COLUMN IF NOT EXISTS avg_price NUMERIC(20, 6),
        ADD COLUMN IF NOT EXISTS total_pnl NUMERIC(20, 6),
        ADD COLUMN IF NOT EXISTS market_resolved_outcome VARCHAR(20);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE alerts
        DROP COLUMN IF EXISTS direction;

      ALTER TABLE polymarket_winners
        DROP COLUMN IF EXISTS position_rank,
        DROP COLUMN IF EXISTS avg_price,
        DROP COLUMN IF EXISTS total_pnl,
        DROP COLUMN IF EXISTS market_resolved_outcome;
    `);
  }
}
