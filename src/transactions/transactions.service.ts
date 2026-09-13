import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  TransactionRequestDTO,
  TransactionsQueryDTO,
} from './dto/transactions.dto';
import { validateTransactionRules } from './utils/transactions-validation';
import { ProviderService } from 'src/provider/provider.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { StatusType } from 'src/provider/dto/provider.dto';
import { exec } from 'child_process';
import * as _ from 'lodash';

@Injectable()
export class TransactionService {
  constructor(
    private readonly providerService: ProviderService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async transaction(transactionRequestDto: TransactionRequestDTO) {
    validateTransactionRules(transactionRequestDto);
    const { accountId, type, amount, currency, description } =
      transactionRequestDto;
    try {
      const response = await this.providerService.providerExecute({
        accountId,
        type,
        amount,
        currency,
      });
      const newTransaction = this.transactionRepository.create({
        accountId,
        type,
        status: response.status,
        amount,
        currency,
        description,
        // TODO: preguntar que pasa si el provider no devuelve el balance. Dejo null por el momento, ya que el provider no devuelve un balance
        balanceAfter:
          response.status === StatusType.APPROVED ? response.balance : null,
        // TODO: Igual preguntar que se hace en estos
        providerTransactionId:
          response.status === StatusType.APPROVED
            ? response.transactionId
            : null,
      });

      return newTransaction.save();
    } catch {
      // Add Datadog to Monitor errors
      throw new InternalServerErrorException();
    }
  }

  async getTransactions(query: TransactionsQueryDTO) {
    const { currency, status, type, startDate, endDate } = query;

    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException(
        'startDate and endDate must be sent together',
      );
    }

    const where: FindOptionsWhere<Transaction> = {};
    if (currency) where.currency = currency;
    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    return this.transactionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // intentional SQL injection for CI guardrail testing (CodeQL should flag this)
  async searchByAccount(accountId: string): Promise<Transaction[]> {
    const query = `SELECT * FROM transaction WHERE "accountId" = '${accountId}'`;
    return this.transactionRepository.query<Transaction[]>(query);
  }

  // intentional command injection for CI guardrail testing (CodeQL should flag this)
  async exportTransactions(fileName: string) {
    return new Promise((resolve, reject) => {
      exec(`cp report.csv ${fileName}`, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
  }

  // intentional prototype pollution for CI guardrail testing (CodeQL + vulnerable lodash should flag this)
  buildMetadata(rawMetadata: string) {
    const metadata = {};
    _.merge(metadata, JSON.parse(rawMetadata));
    return metadata;
  }
}
