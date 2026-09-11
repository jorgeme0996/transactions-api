import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionService } from './transactions.service';
import {
  TransactionRequestDTO,
  TransactionsQueryDTO,
  TransactionType,
} from './dto/transactions.dto';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let transactionService: {
    transaction: jest.Mock;
    getTransactions: jest.Mock;
  };

  beforeEach(async () => {
    transactionService = {
      transaction: jest.fn(),
      getTransactions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionService, useValue: transactionService },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transaction', () => {
    it('should delegate to TransactionService.transaction and return its result', async () => {
      const dto: TransactionRequestDTO = {
        accountId: 'acc-1',
        type: TransactionType.CREDIT,
        amount: 100,
        currency: 'MXN',
        description: 'test transaction',
      };
      const expected = { uuid: 'tx-1' };
      transactionService.transaction.mockResolvedValue(expected);

      const result = await controller.transaction(dto);

      expect(transactionService.transaction).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('transactions', () => {
    it('should delegate to TransactionService.getTransactions and return its result', async () => {
      const query: TransactionsQueryDTO = { currency: 'MXN' };
      const expected = [{ uuid: 'tx-1' }];
      transactionService.getTransactions.mockResolvedValue(expected);

      const result = await controller.transactions(query);

      expect(transactionService.getTransactions).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });
});
