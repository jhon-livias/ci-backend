import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { FollowUpService } from './application/follow-up.service.js';
import { TeacherSessionsService } from './application/teacher-sessions.service.js';
import { AttendancePrismaService } from './infrastructure/persistence/attendance-prisma.service.js';
import { FollowUpController, InternalAttendanceGuard } from './interfaces/http/follow-up.controller.js';
import { TeacherSessionsController } from './interfaces/http/teacher-sessions.controller.js';

const HealthController = createHealthController('attendance-grades');

@Module({
  controllers: [HealthController, FollowUpController, TeacherSessionsController],
  providers: [AttendancePrismaService, InternalAttendanceGuard, FollowUpService, TeacherSessionsService],
})
export class AppModule {}
