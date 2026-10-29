import { Body, Controller, Get, Header, Injectable, Param, ParseUUIDPipe, Patch, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { UpdateTariffDto } from '../../../../../../libs/contracts/src/payment-catalog.dto.js';
import { PaymentCatalogService } from '../../application/payment-catalog.service.js';

@Injectable()
export class InternalPaymentsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!secret || secret.length < 32 || typeof supplied !== 'string') throw new UnauthorizedException();
    const a = Buffer.from(secret); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

@Controller('internal/payments')
@UseGuards(InternalPaymentsGuard)
export class PaymentCatalogController {
  constructor(private readonly catalog: PaymentCatalogService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read() {
    return this.catalog.read();
  }

  @Patch('tariffs/:id')
  @Header('Cache-Control', 'no-store')
  updateTariff(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTariffDto) {
    return this.catalog.updateTariff(id, dto.amountCents);
  }

  @Patch('incidents/:id/resolve')
  @Header('Cache-Control', 'no-store')
  resolveIncident(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.resolveIncident(id);
  }
}
