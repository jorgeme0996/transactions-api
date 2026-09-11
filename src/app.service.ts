import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthCheck(): object {
    return {
      healthy: true,
      imageTag: process.env.IMAGE_TAG ?? 'unknown',
      buildDate: process.env.BUILD_DATE ?? 'unknown',
    };
  }
}
