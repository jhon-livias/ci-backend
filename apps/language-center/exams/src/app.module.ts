import { Module } from '@nestjs/common';

import { createHealthController } from '../../../../libs/common/src/index.js';

const HealthController = createHealthController('exams');

@Module({ controllers: [HealthController] })
export class AppModule {}
