import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { createHealthController } from '../../../libs/common/src/index.js';
import { StudyPlansService } from './application/study-plans.service.js';
import { StudyPlansPrismaService } from './infrastructure/persistence/study-plans-prisma.service.js';
import { StudyPlansController } from './interfaces/http/study-plans.controller.js';
import { StudyPlansSessionGuard } from './interfaces/http/study-plans-session.js';

const HealthController = createHealthController('study-plans');
const accessTokenSecret = process.env.AUTH_JWT_ACCESS_SECRET;

if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error('AUTH_JWT_ACCESS_SECRET debe tener al menos 32 caracteres.');
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: accessTokenSecret,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [HealthController, StudyPlansController],
  providers: [StudyPlansPrismaService, StudyPlansService, StudyPlansSessionGuard],
})
export class AppModule {}
