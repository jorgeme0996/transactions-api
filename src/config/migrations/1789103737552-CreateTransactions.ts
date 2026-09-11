import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactions1789103737552 implements MigrationInterface {
    name = 'CreateTransactions1789103737552'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transactions" (
            uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
            account_id VARCHAR NOT NULL,
            type VARCHAR NOT NULL,
            amount NUMERIC NOT NULL,
            currency VARCHAR NOT NULL,
            description VARCHAR,
            status VARCHAR NOT NULL,
            provider_transaction_id VARCHAR,
            balance_after NUMERIC,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "transactions"`);
    }

}
