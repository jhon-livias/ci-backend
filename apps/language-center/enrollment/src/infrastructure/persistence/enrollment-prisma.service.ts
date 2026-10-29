import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

@Injectable()
export class EnrollmentPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.ENROLLMENT_DATABASE_URL;
    if (!connectionString) throw new Error('ENROLLMENT_DATABASE_URL es obligatoria.');
    super({ adapter: new PrismaPg(connectionString, { schema: 'enrollment' }) });
  }
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
