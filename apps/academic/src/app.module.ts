import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { AcademicPrismaService } from './infrastructure/persistence/academic-prisma.service.js';
import { AcademicConfigController } from './interfaces/http/academic-config.controller.js';
import { InternalSitesGuard, SitesController } from './interfaces/http/sites.controller.js';
import { AcademicConfigService } from './application/academic-config.service.js';
import { AcademicGroupsService } from './application/academic-groups.service.js';
import { PeruGeographySeeder } from './application/peru-geography-seeder.service.js';
import { ScheduleComboService } from './application/schedule-combo.service.js';
import { TeacherProfilesService } from './application/teacher-profiles.service.js';
import { SitesService } from './application/sites.service.js';
import { DirectorOperationsController } from './interfaces/http/director-operations.controller.js';

const HealthController = createHealthController('academic');

@Module({
  controllers: [HealthController, SitesController, AcademicConfigController, DirectorOperationsController],
  providers: [
    AcademicPrismaService,
    InternalSitesGuard,
    PeruGeographySeeder,
    SitesService,
    AcademicConfigService,
    ScheduleComboService,
    AcademicGroupsService,
    TeacherProfilesService,
  ],
})
export class AppModule {}
