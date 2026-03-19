import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuspectScoreToWalletProfiles1710000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wallet_profiles
        ADD COLUMN IF NOT EXISTS suspect_score  NUMERIC(5, 2),
        ADD COLUMN IF NOT EXISTS win_rate       NUMERIC(5, 2),
        ADD COLUMN IF NOT EXISTS signal_count   INT,
        ADD COLUMN IF NOT EXISTS total_wagered  NUMERIC(20, 6);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wallet_profiles
        DROP COLUMN IF EXISTS suspect_score,
        DROP COLUMN IF EXISTS win_rate,
        DROP COLUMN IF EXISTS signal_count,
        DROP COLUMN IF EXISTS total_wagered;
    `);
  }
}
