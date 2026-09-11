import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1587742944794 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`, undefined);
    await queryRunner.query(
        `
            CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
            BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS pgcrypto;`, undefined);
    await queryRunner.query(`DROP FUNCTION IF EXISTS 'set_updated_at';`, undefined);
  }
}
