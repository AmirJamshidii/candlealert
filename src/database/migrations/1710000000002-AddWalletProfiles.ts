import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletProfiles1710000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wallet_profiles (
        wallet_address          VARCHAR(42)    PRIMARY KEY,
        total_positions         INT            NOT NULL DEFAULT 0,
        total_current_value     NUMERIC(20, 6) NOT NULL DEFAULT 0,
        total_realized_pnl      NUMERIC(20, 6) NOT NULL DEFAULT 0,
        total_cash_pnl          NUMERIC(20, 6) NOT NULL DEFAULT 0,
        btc_updown_positions    INT            NOT NULL DEFAULT 0,
        favorite_categories     JSONB          NOT NULL DEFAULT '[]',
        fetched_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wallet_profiles;`);
  }
}
