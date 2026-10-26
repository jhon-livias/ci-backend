import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { AcademicPrismaService } from './infrastructure/persistence/academic-prisma.service.js';
import { InternalSitesGuard, SitesController } from './interfaces/http/sites.controller.js';
import { PeruGeographySeeder } from './application/peru-geography-seeder.service.js';

const HealthController = createHealthController('academic');

@Module({ controllers: [HealthController, SitesController], providers: [AcademicPrismaService, InternalSitesGuard, PeruGeographySeeder] })
export class AppModule {}
