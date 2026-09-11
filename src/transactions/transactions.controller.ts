import { Body, Controller, Get, Post, Query, ValidationPipe } from '@nestjs/common';
import { TransactionService } from './transactions.service';
import { TransactionRequestDTO, TransactionsQueryDTO } from './dto/transactions.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionService: TransactionService
  ) {}

  @Post()
  transaction(@Body(ValidationPipe) transactionRequestDto: TransactionRequestDTO) {
    return this.transactionService.transaction(transactionRequestDto)
  }

  @Get()
  transactions(@Query(ValidationPipe) query: TransactionsQueryDTO) {
    return this.transactionService.getTransactions(query)
  }
}
