import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  const healthCheckResult = {
    healthy: true,
    imageTag: 'test-tag',
    buildDate: '2026-09-11',
  };

  const getHealthCheck = jest.fn().mockReturnValue(healthCheckResult);

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHealthCheck },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('base', () => {
    it('should return the health check result', () => {
      expect(appController.base()).toEqual(healthCheckResult);
      expect(getHealthCheck).toHaveBeenCalled();
    });
  });

  describe('getHealthCheck', () => {
    it('should return the health check result', () => {
      expect(appController.getHealthCheck()).toEqual(healthCheckResult);
      expect(getHealthCheck).toHaveBeenCalled();
    });
  });
});
