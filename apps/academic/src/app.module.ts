import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { AcademicPrismaService } from './infrastructure/persistence/academic-prisma.service.js';
import { AcademicConfigController } from './interfaces/http/academic-config.controller.js';
import { InternalSitesGuard, SitesController } from './interfaces/http/sites.controller.js';
import { AcademicConfigService } from './application/academic-config.service.js';
import { PeruGeographySeeder } from './application/peru-geography-seeder.service.js';
import { SitesService } from './application/sites.service.js';

const HealthController = createHealthController('academic');

@Module({ controllers: [HealthController, SitesController, AcademicConfigController], providers: [AcademicPrismaService, InternalSitesGuard, PeruGeographySeeder, SitesService, AcademicConfigService] })
export class AppModule {}
