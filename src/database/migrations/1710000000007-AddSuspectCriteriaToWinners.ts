import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuspectCriteriaToWinners1710000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE polymarket_winners
        ADD COLUMN IF NOT EXISTS suspect_score       NUMERIC(5, 2) CHECK (suspect_score BETWEEN 0 AND 100),
        ADD COLUMN IF NOT EXISTS criterion_new_wallet    BOOLEAN,
        ADD COLUMN IF NOT EXISTS criterion_buy_only      BOOLEAN,
        ADD COLUMN IF NOT EXISTS criterion_position_value BOOLEAN,
        ADD COLUMN IF NOT EXISTS criterion_conviction    BOOLEAN;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE polymarket_winners
        DROP COLUMN IF EXISTS suspect_score,
        DROP COLUMN IF EXISTS criterion_new_wallet,
        DROP COLUMN IF EXISTS criterion_buy_only,
        DROP COLUMN IF EXISTS criterion_position_value,
        DROP COLUMN IF EXISTS criterion_conviction;
    `);
  }
}
