import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { TransactionService } from './transactions.service';
import {
  TransactionRequestDTO,
  TransactionsQueryDTO,
} from './dto/transactions.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  transaction(
    @Body(ValidationPipe) transactionRequestDto: TransactionRequestDTO,
  ) {
    return this.transactionService.transaction(transactionRequestDto);
  }

  @Get()
  transactions(@Query(ValidationPipe) query: TransactionsQueryDTO) {
    return this.transactionService.getTransactions(query);
  }

  @Get('search')
  search(@Query('accountId') accountId: string) {
    const result = this.transactionService.searchByAccount(accountId);
    return result;
  }

  @Get('export')
  export(@Query('fileName') fileName: string) {
    return this.transactionService.exportTransactions(fileName);
  }

  @Post('metadata')
  metadata(@Body('rawMetadata') rawMetadata: string) {
    return this.transactionService.buildMetadata(rawMetadata);
  }
}
