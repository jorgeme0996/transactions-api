import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { TransactionRequestDTO, TransactionsQueryDTO } from "./dto/transactions.dto";
import { validateTransactionRules } from "./utils/transactions-validation";
import { ProviderService } from "src/provider/provider.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Transaction } from "./transaction.entity";
import { Between, FindOptionsWhere, Repository } from "typeorm";
import { StatusType } from "src/provider/dto/provider.dto";

@Injectable()
export class TransactionService {
  constructor(
    private readonly providerService: ProviderService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ){}

  async transaction(transactionRequestDto: TransactionRequestDTO) {
    validateTransactionRules(transactionRequestDto)
    const { accountId, type, amount, currency, description } = transactionRequestDto
    try {
      const response = await this.providerService.providerExecute({
        accountId,
        type,
        amount,
        currency
      })
      const newTransaction = this.transactionRepository.create({
        accountId,
        type,
        status: response.status,
        amount,
        currency,
        description,
        // TODO: preguntar que pasa si el provider no devuelve el balance. Dejo null por el momento, ya que el provider no devuelve un balance
        balanceAfter: response.status === StatusType.APPROVED ? response.balance: null,
        // TODO: Igual preguntar que se hace en estos
        providerTransactionId: response.status === StatusType.APPROVED ? response.transactionId: null
      })

      return newTransaction.save()
    } catch (error) {
      // Add Datadog to Monitor errors
      throw new InternalServerErrorException()
    }
  }


  async getTransactions(query: TransactionsQueryDTO) {
    const { currency, status, type, startDate, endDate } = query

    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException('startDate and endDate must be sent together')
    }

    const where: FindOptionsWhere<Transaction> = {}
    if (currency) where.currency = currency
    if (status) where.status = status
    if (type) where.type = type
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate))
    }

    return this.transactionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    })
  }

}