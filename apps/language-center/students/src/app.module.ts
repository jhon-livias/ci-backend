import { Module } from '@nestjs/common';

import { createHealthController } from '../../../../libs/common/src/index.js';
import { StudentDirectoryService } from './application/student-directory.service.js';
import { StudentsPrismaService } from './infrastructure/persistence/students-prisma.service.js';
import { InternalStudentsGuard, StudentDirectoryController } from './interfaces/http/student-directory.controller.js';

const HealthController = createHealthController('students');

@Module({
  controllers: [HealthController, StudentDirectoryController],
  providers: [StudentsPrismaService, InternalStudentsGuard, StudentDirectoryService],
})
export class AppModule {}
