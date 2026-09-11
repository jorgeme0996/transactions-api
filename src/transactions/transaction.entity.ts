import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";
import { TransactionType } from "./dto/transactions.dto";

@Entity({ name: 'transactions' })
export class Transaction extends BaseEntity {
  @PrimaryColumn('uuid')
  uuid: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column()
  type: TransactionType;

  @Column()
  amount: number;

  @Column()
  currency: string;

  @Column()
  description: string;

  @Column()
  status: string;

  @Column({ name: 'provider_transaction_id', type: 'varchar', nullable: true })
  providerTransactionId: string | null;

  @Column({ name: 'balance_after', type: 'numeric', nullable: true })
  balanceAfter: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}