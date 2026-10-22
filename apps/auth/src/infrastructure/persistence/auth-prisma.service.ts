import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

@Injectable()
export class AuthPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.AUTH_DATABASE_URL;

    if (!connectionString) {
      throw new Error('AUTH_DATABASE_URL es obligatoria para iniciar el servicio auth.');
    }

    super({ adapter: new PrismaPg(connectionString, { schema: 'auth' }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
