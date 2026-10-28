import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, HttpException, Param, ParseUUIDPipe, Patch, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { formatSoles, PaymentCatalogError, normalizeAmountCents } from '../../../../../libs/contracts/src/payment-catalog.js';
import { UpdateTariffDto } from '../../../../../libs/contracts/src/payment-catalog.dto.js';
import { AuditLogService } from '../../application/audit-log.service.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

@Controller('auth/admin/payments')
export class PaymentsProxyController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async read(@Req() request: FastifyRequest) {
    await this.authorize(request, 'payments.read');
    return this.forward('GET');
  }

  @Patch('tariffs/:id')
  @Header('Cache-Control', 'no-store')
  async updateTariff(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTariffDto) {
    const actor = await this.authorize(request, 'payments.update');
    const amountCents = this.cents(dto.amountCents);
    const updated = await this.forward('PATCH', `tariffs/${id}`, { amountCents });
    const name = isRecord(updated) && typeof updated['name'] === 'string' ? updated['name'] : 'la tarifa';
    await this.audit.recordFor(actor.id, 'Tarifas y pagos', `Modificó la tarifa ${name} a S/ ${formatSoles(amountCents)}.`);
    return updated;
  }

  @Patch('incidents/:id/resolve')
  @Header('Cache-Control', 'no-store')
  async resolveIncident(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const actor = await this.authorize(request, 'payments.update');
    const resolved = await this.forward('PATCH', `incidents/${id}/resolve`);
    const student = isRecord(resolved) && typeof resolved['studentName'] === 'string' ? resolved['studentName'] : 'un alumno';
    await this.audit.recordFor(actor.id, 'Tarifas y pagos', `Marcó resuelta la incidencia de ${student}.`);
    return resolved;
  }

  private cents(value: number): number {
    try {
      return normalizeAmountCents(value);
    } catch (error) {
      if (error instanceof PaymentCatalogError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private async forward(method: string, path?: string, body?: unknown): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const upstream = process.env.PAYMENTS_UPSTREAM ?? 'http://payments:3007';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}/api/v1/internal/payments${path ? `/${path}` : ''}`, {
        method,
        headers: { 'x-internal-secret': secret, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException();
    }
    if (!response.ok) {
      if ([400, 404, 409].includes(response.status)) throw new HttpException(await this.safeMessage(response), response.status);
      throw new ServiceUnavailableException();
    }
    return response.status === 204 ? undefined : await response.json();
  }

  private async safeMessage(response: Response): Promise<string> {
    const body = await response.json().catch(() => null);
    const message = isRecord(body) ? body['message'] : undefined;
    return typeof message === 'string' && /^[^<>]{1,160}$/u.test(message) ? message : 'No se pudo completar la operación.';
  }
}
