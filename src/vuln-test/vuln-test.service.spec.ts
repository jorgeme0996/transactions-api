import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { exec } from 'child_process';
import { VulnTestService } from './vuln-test.service';
import { Transaction } from '../transactions/transaction.entity';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('VulnTestService', () => {
  let service: VulnTestService;
  let transactionRepository: { query: jest.Mock };

  beforeEach(async () => {
    transactionRepository = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VulnTestService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepository,
        },
      ],
    }).compile();

    service = module.get<VulnTestService>(VulnTestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('searchByDescription builds a raw query and delegates to the repository', async () => {
    const expected = [{ uuid: 'tx-1' }];
    transactionRepository.query.mockResolvedValue(expected);

    const result: unknown = await service.searchByDescription("' OR '1'='1");

    expect(transactionRepository.query).toHaveBeenCalledWith(
      "SELECT * FROM transaction WHERE description = '' OR '1'='1'",
    );
    expect(result).toBe(expected);
  });

  it('pingHost resolves with stdout on success', async () => {
    (exec as unknown as jest.Mock).mockImplementation(
      (_cmd: string, cb: (error: unknown, stdout: string) => void) => {
        cb(null, 'pong');
      },
    );

    const result = await service.pingHost('localhost');

    expect(exec).toHaveBeenCalledWith(
      'ping -c 1 localhost',
      expect.any(Function),
    );
    expect(result).toBe('pong');
  });

  it('pingHost rejects when exec errors', async () => {
    const error = new Error('boom');
    (exec as unknown as jest.Mock).mockImplementation(
      (_cmd: string, cb: (error: unknown, stdout: string) => void) => {
        cb(error, '');
      },
    );

    await expect(service.pingHost('localhost')).rejects.toBe(error);
  });

  it('getDebugCredentials returns the hardcoded fixture credentials', () => {
    const result = service.getDebugCredentials();

    expect(result).toEqual({
      AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    });
  });
});
