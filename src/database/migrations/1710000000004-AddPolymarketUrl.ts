import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPolymarketUrl1710000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE alerts
        ADD COLUMN IF NOT EXISTS polymarket_url VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE alerts DROP COLUMN IF EXISTS polymarket_url;
    `);
  }
}
