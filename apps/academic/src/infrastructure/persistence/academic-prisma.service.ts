import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

@Injectable()
export class AcademicPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.ACADEMIC_DATABASE_URL;
    if (!connectionString) throw new Error('ACADEMIC_DATABASE_URL es obligatoria.');
    super({ adapter: new PrismaPg(connectionString, { schema: 'academic' }) });
  }
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
