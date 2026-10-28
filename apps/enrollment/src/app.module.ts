import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { EnrollmentService } from './application/enrollment.service.js';
import { EnrollmentPrismaService } from './infrastructure/persistence/enrollment-prisma.service.js';
import { EnrollmentController, InternalEnrollmentGuard } from './interfaces/http/enrollment.controller.js';

const HealthController = createHealthController('enrollment');

@Module({
  controllers: [HealthController, EnrollmentController],
  providers: [EnrollmentPrismaService, InternalEnrollmentGuard, EnrollmentService],
})
export class AppModule {}
