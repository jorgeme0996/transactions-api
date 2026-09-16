import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { TransactionService } from './transactions.service';
import { ProviderService } from 'src/provider/provider.service';
import { Transaction } from './transaction.entity';
import {
  TransactionRequestDTO,
  TransactionsQueryDTO,
  TransactionType,
} from './dto/transactions.dto';
import { StatusType } from 'src/provider/dto/provider.dto';

describe('TransactionService', () => {
  let service: TransactionService;
  let providerService: { providerExecute: jest.Mock };
  let transactionRepository: {
    create: jest.Mock;
    find: jest.Mock<Promise<Transaction[]>, [FindManyOptions<Transaction>]>;
  };

  const baseRequest: TransactionRequestDTO = {
    accountId: 'acc-1',
    type: TransactionType.CREDIT,
    amount: 100,
    currency: 'MXN',
    description: 'test transaction',
  };

  beforeEach(async () => {
    providerService = { providerExecute: jest.fn() };
    transactionRepository = {
      create: jest.fn(),
      find: jest.fn<Promise<Transaction[]>, [FindManyOptions<Transaction>]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: ProviderService, useValue: providerService },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transaction', () => {
    it('should throw BadRequestException for an unsupported currency without calling the provider', async () => {
      await expect(
        service.transaction({ ...baseRequest, currency: 'usd' }),
      ).rejects.toThrow(BadRequestException);

      expect(providerService.providerExecute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the amount is not greater than 1', async () => {
      await expect(
        service.transaction({ ...baseRequest, amount: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a DEBIT exceeds 10000', async () => {
      await expect(
        service.transaction({
          ...baseRequest,
          type: TransactionType.DEBIT,
          amount: 10001,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow a DEBIT of exactly 10000', async () => {
      providerService.providerExecute.mockResolvedValue({
        status: StatusType.APPROVED,
        transactionId: 'prov-1',
        balance: 900,
        executedAt: new Date(),
      });
      transactionRepository.create.mockReturnValue({
        save: jest.fn().mockResolvedValue({ uuid: 'tx-1' }),
      });

      await expect(
        service.transaction({
          ...baseRequest,
          type: TransactionType.DEBIT,
          amount: 10000,
        }),
      ).resolves.toBeDefined();
    });

    it('should allow a DEBIT below 10000', async () => {
      providerService.providerExecute.mockResolvedValue({
        status: StatusType.APPROVED,
        transactionId: 'prov-1',
        balance: 900,
        executedAt: new Date(),
      });
      transactionRepository.create.mockReturnValue({
        save: jest.fn().mockResolvedValue({ uuid: 'tx-1' }),
      });

      await expect(
        service.transaction({
          ...baseRequest,
          type: TransactionType.DEBIT,
          amount: 5000,
        }),
      ).resolves.toBeDefined();
    });

    it('should create and save a transaction when the provider approves it', async () => {
      const providerResponse = {
        status: StatusType.APPROVED,
        transactionId: 'prov-1',
        balance: 900,
        executedAt: new Date(),
      };
      providerService.providerExecute.mockResolvedValue(providerResponse);

      const savedTransaction = { uuid: 'tx-1' };
      const createdEntity = {
        save: jest.fn().mockResolvedValue(savedTransaction),
      };
      transactionRepository.create.mockReturnValue(createdEntity);

      const result = await service.transaction(baseRequest);

      expect(providerService.providerExecute).toHaveBeenCalledWith({
        accountId: baseRequest.accountId,
        type: baseRequest.type,
        amount: baseRequest.amount,
        currency: baseRequest.currency,
      });
      expect(transactionRepository.create).toHaveBeenCalledWith({
        accountId: baseRequest.accountId,
        type: baseRequest.type,
        status: StatusType.APPROVED,
        amount: baseRequest.amount,
        currency: baseRequest.currency,
        description: baseRequest.description,
        balanceAfter: providerResponse.balance,
        providerTransactionId: providerResponse.transactionId,
      });
      expect(createdEntity.save).toHaveBeenCalled();
      expect(result).toBe(savedTransaction);
    });

    it('should save with a null balance and providerTransactionId when the provider rejects it', async () => {
      providerService.providerExecute.mockResolvedValue({
        status: StatusType.REJECTED,
        code: 'INSUFFICIENT_FUNDS',
        message: 'no funds',
      });

      const createdEntity = { save: jest.fn().mockResolvedValue({}) };
      transactionRepository.create.mockReturnValue(createdEntity);

      await service.transaction(baseRequest);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StatusType.REJECTED,
          balanceAfter: null,
          providerTransactionId: null,
        }),
      );
    });

    it('should throw InternalServerErrorException when the provider call fails', async () => {
      providerService.providerExecute.mockRejectedValue(
        new Error('network error'),
      );

      await expect(service.transaction(baseRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getTransactions', () => {
    it('should throw BadRequestException when only startDate is provided', async () => {
      await expect(
        service.getTransactions({
          startDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when only endDate is provided', async () => {
      await expect(
        service.getTransactions({
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should query with the provided filters and order by createdAt DESC', async () => {
      const transactions = [{ uuid: 'tx-1' }] as Transaction[];
      transactionRepository.find.mockResolvedValue(transactions);

      const query: TransactionsQueryDTO = {
        currency: 'MXN',
        status: StatusType.APPROVED,
        type: TransactionType.CREDIT,
      };

      const result = await service.getTransactions(query);

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          currency: 'MXN',
          status: StatusType.APPROVED,
          type: TransactionType.CREDIT,
        },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(transactions);
    });

    it('should build a date range filter when startDate and endDate are provided', async () => {
      transactionRepository.find.mockResolvedValue([]);

      await service.getTransactions({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const callArgs = transactionRepository.find.mock.calls[0][0];
      const where = callArgs.where as FindOptionsWhere<Transaction>;
      expect(where.createdAt).toBeDefined();
      expect(callArgs.order).toEqual({ createdAt: 'DESC' });
    });

    it('should return an empty where clause when no filters are provided', async () => {
      transactionRepository.find.mockResolvedValue([]);

      await service.getTransactions({});

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
      });
    });
  });
});
