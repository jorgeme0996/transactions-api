import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthCheck(): object {
    return {
      healthy: true,
    };
  }
}
