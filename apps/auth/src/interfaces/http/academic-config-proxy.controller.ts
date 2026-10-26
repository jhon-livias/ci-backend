import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, HttpException, Param, ParseUUIDPipe, Post, Put, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AcademicConfigError, ACADEMIC_CATALOG_TITLES, isAcademicCatalogKind, normalizeAcademicRules, normalizeCatalogName } from '../../../../../libs/contracts/src/academic-config.js';
import { AcademicCatalogItemDto, AcademicRulesDto } from '../../../../../libs/contracts/src/academic-config.dto.js';
import { AuditLogService } from '../../application/audit-log.service.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

@Controller('auth/admin/academic-config')
export class AcademicConfigProxyController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async read(@Req() request: FastifyRequest) {
    await this.authorize(request, 'academic_config.read');
    return this.forward('GET');
  }

  @Post('items')
  @Header('Cache-Control', 'no-store')
  async addItem(@Req() request: FastifyRequest, @Body() dto: AcademicCatalogItemDto) {
    const actor = await this.authorize(request, 'academic_config.update');
    const name = this.catalogName(dto.name);
    const created = await this.forward('POST', 'items', { kind: dto.kind, name });
    await this.audit.recordFor(actor.id, 'Configuración académica', `Agregó ${name} al catálogo de ${ACADEMIC_CATALOG_TITLES[dto.kind]}.`);
    return created;
  }

  @Delete('items/:id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async removeItem(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const actor = await this.authorize(request, 'academic_config.update');
    const removed = await this.forward('DELETE', `items/${id}`);
    const name = isRecord(removed) && typeof removed['name'] === 'string' ? removed['name'] : '';
    const kind = isRecord(removed) && typeof removed['kind'] === 'string' && isAcademicCatalogKind(removed['kind']) ? removed['kind'] : null;
    if (name && kind) await this.audit.recordFor(actor.id, 'Configuración académica', `Quitó ${name} del catálogo de ${ACADEMIC_CATALOG_TITLES[kind]}.`);
  }

  @Put('rules')
  @Header('Cache-Control', 'no-store')
  async saveRules(@Req() request: FastifyRequest, @Body() dto: AcademicRulesDto) {
    const actor = await this.authorize(request, 'academic_config.update');
    const rules = this.rules(dto);
    const saved = await this.forward('PUT', 'rules', rules);
    await this.audit.recordFor(actor.id, 'Configuración académica', 'Guardó las reglas académicas.');
    return saved;
  }

  private catalogName(value: string): string {
    try {
      return normalizeCatalogName(value);
    } catch (error) {
      if (error instanceof AcademicConfigError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private rules(dto: AcademicRulesDto) {
    try {
      return normalizeAcademicRules(dto);
    } catch (error) {
      if (error instanceof AcademicConfigError) throw new BadRequestException(error.message);
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
    const upstream = process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}/api/v1/internal/academic-config${path ? `/${path}` : ''}`, {
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
