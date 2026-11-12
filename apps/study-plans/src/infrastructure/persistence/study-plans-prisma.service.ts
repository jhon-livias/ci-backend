import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

@Injectable()
export class StudyPlansPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.STUDY_PLANS_DATABASE_URL;
    if (!connectionString) throw new Error('STUDY_PLANS_DATABASE_URL es obligatoria para iniciar el servicio study-plans.');
    super({ adapter: new PrismaPg(connectionString, { schema: 'study_plans' }) });
  }
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
