import { Module } from '@nestjs/common';
import { TransactionService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { ProviderModule } from 'src/provider/provider.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    ProviderModule
  ],
  controllers: [TransactionsController],
  providers: [TransactionService],
})
export class TransactionsModule {}
