import { Test, TestingModule } from '@nestjs/testing';
import { VulnTestController } from './vuln-test.controller';
import { VulnTestService } from './vuln-test.service';

describe('VulnTestController', () => {
  let controller: VulnTestController;
  let vulnTestService: {
    searchByDescription: jest.Mock;
    pingHost: jest.Mock;
    getDebugCredentials: jest.Mock;
  };

  beforeEach(async () => {
    vulnTestService = {
      searchByDescription: jest.fn(),
      pingHost: jest.fn(),
      getDebugCredentials: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VulnTestController],
      providers: [{ provide: VulnTestService, useValue: vulnTestService }],
    }).compile();

    controller = module.get<VulnTestController>(VulnTestController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('search delegates to VulnTestService.searchByDescription', async () => {
    const expected = [{ uuid: 'tx-1' }];
    vulnTestService.searchByDescription.mockResolvedValue(expected);

    const result: unknown = await controller.search("' OR '1'='1");

    expect(vulnTestService.searchByDescription).toHaveBeenCalledWith(
      "' OR '1'='1",
    );
    expect(result).toBe(expected);
  });

  it('ping delegates to VulnTestService.pingHost', async () => {
    vulnTestService.pingHost.mockResolvedValue('pong');

    const result = await controller.ping('localhost');

    expect(vulnTestService.pingHost).toHaveBeenCalledWith('localhost');
    expect(result).toBe('pong');
  });

  it('debugCredentials delegates to VulnTestService.getDebugCredentials', () => {
    const expected = { AWS_ACCESS_KEY_ID: 'fake' };
    vulnTestService.getDebugCredentials.mockReturnValue(expected);

    const result = controller.debugCredentials();

    expect(vulnTestService.getDebugCredentials).toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});
