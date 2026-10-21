import { Controller, Get } from '@nestjs/common';

import type { ServiceName } from '../../contracts/src/index.js';

export const createHealthController = (service: ServiceName) => {
  @Controller('health')
  class HealthController {
    @Get()
    getHealth(): { service: ServiceName; status: 'ok' } {
      return { service, status: 'ok' };
    }
  }

  return HealthController;
};
