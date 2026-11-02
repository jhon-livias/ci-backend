import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { createHealthController } from '../../../libs/common/src/index.js';
import { CatalogService } from './application/catalog.service.js';
import { TicketsService } from './application/tickets.service.js';
import { TicketsPrismaService } from './infrastructure/persistence/tickets-prisma.service.js';
import { CatalogController } from './interfaces/http/catalog.controller.js';
import { TicketsController } from './interfaces/http/tickets.controller.js';
import { TicketsSessionGuard } from './interfaces/http/tickets-session.js';

const HealthController = createHealthController('tickets');
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
  controllers: [HealthController, CatalogController, TicketsController],
  providers: [TicketsPrismaService, CatalogService, TicketsService, TicketsSessionGuard],
})
export class AppModule {}
