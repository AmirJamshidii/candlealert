import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayNames1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE polymarket_winners
        ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

      ALTER TABLE wallet_profiles
        ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE polymarket_winners DROP COLUMN IF EXISTS display_name;
      ALTER TABLE wallet_profiles    DROP COLUMN IF EXISTS display_name;
    `);
  }
}
