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
      process.env.IMAGE_TAG = '1.2.3';
      process.env.BUILD_DATE = '2026-09-11';

      expect(appService.getHealthCheck()).toEqual({
        healthy: true,
        imageTag: '1.2.3',
        buildDate: '2026-09-11',
      });
    });

    it('should default imageTag and buildDate to "unknown" when env vars are missing', () => {
      delete process.env.IMAGE_TAG;
      delete process.env.BUILD_DATE;

      expect(appService.getHealthCheck()).toEqual({
        healthy: true,
        imageTag: 'unknown',
        buildDate: 'unknown',
      });
    });
  });
});
