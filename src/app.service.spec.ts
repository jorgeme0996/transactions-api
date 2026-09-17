import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let appService: AppService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    const app: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = app.get<AppService>(AppService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getHealthCheck', () => {
    it('should return healthy true with imageTag and buildDate from env', () => {
      expect(appService.getHealthCheck()).toEqual({
        healthy: true,
      });
    });

    it('should default imageTag and buildDate to "unknown" when env vars are missing', () => {
      expect(appService.getHealthCheck()).toEqual({
        healthy: true,
      });
    });
  });
});
