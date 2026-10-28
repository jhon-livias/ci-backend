import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { FollowUpService } from './application/follow-up.service.js';
import { FollowUpController, InternalAttendanceGuard } from './interfaces/http/follow-up.controller.js';

const HealthController = createHealthController('attendance-grades');

@Module({
  controllers: [HealthController, FollowUpController],
  providers: [InternalAttendanceGuard, FollowUpService],
})
export class AppModule {}
