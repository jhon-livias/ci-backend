import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { TicketsPrismaService } from './infrastructure/persistence/tickets-prisma.service.js';

const HealthController = createHealthController('tickets');

@Module({ controllers: [HealthController], providers: [TicketsPrismaService] })
export class AppModule {}
