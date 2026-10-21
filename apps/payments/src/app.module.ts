import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';

const HealthController = createHealthController('payments');

@Module({ controllers: [HealthController] })
export class AppModule {}
