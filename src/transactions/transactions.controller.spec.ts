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
    searchByAccount: jest.Mock;
    exportTransactions: jest.Mock;
    buildMetadata: jest.Mock;
  };

  beforeEach(async () => {
    transactionService = {
      transaction: jest.fn(),
      getTransactions: jest.fn(),
      searchByAccount: jest.fn(),
      exportTransactions: jest.fn(),
      buildMetadata: jest.fn(),
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

  describe('search', () => {
    it('should delegate to TransactionService.searchByAccount and return its result', async () => {
      const expected = [{ uuid: 'tx-1' }];
      transactionService.searchByAccount.mockResolvedValue(expected);

      const result = await controller.search('acc-1');

      expect(transactionService.searchByAccount).toHaveBeenCalledWith('acc-1');
      expect(result).toBe(expected);
    });
  });

  describe('export', () => {
    it('should delegate to TransactionService.exportTransactions and return its result', async () => {
      transactionService.exportTransactions.mockResolvedValue('ok');

      const result = await controller.export('out.csv');

      expect(transactionService.exportTransactions).toHaveBeenCalledWith(
        'out.csv',
      );
      expect(result).toBe('ok');
    });
  });

  describe('metadata', () => {
    it('should delegate to TransactionService.buildMetadata and return its result', () => {
      const expected = { key: 'value' };
      transactionService.buildMetadata.mockReturnValue(expected);

      const result = controller.metadata('{"key":"value"}');

      expect(transactionService.buildMetadata).toHaveBeenCalledWith(
        '{"key":"value"}',
      );
      expect(result).toBe(expected);
    });
  });
});
