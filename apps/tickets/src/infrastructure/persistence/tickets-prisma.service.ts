import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

@Injectable()
export class TicketsPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.TICKETS_DATABASE_URL;
    if (!connectionString) throw new Error('TICKETS_DATABASE_URL es obligatoria para iniciar el servicio tickets.');
    super({ adapter: new PrismaPg(connectionString, { schema: 'tickets' }) });
  }
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
