import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';

const HealthController = createHealthController('attendance-grades');

@Module({ controllers: [HealthController] })
export class AppModule {}
