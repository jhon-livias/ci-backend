import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, HttpException, Param, ParseUUIDPipe, Patch, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuditLogService } from '../../application/audit-log.service.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

@Controller('auth/director')
export class DirectorAcademicProxyController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly audit: AuditLogService,
  ) {}

  @Get('catalogs')
  @Header('Cache-Control', 'no-store')
  async catalogs(@Req() request: FastifyRequest) {
    await this.authorize(request, 'groups.read');
    return this.forward('GET', '/api/v1/internal/academic-config');
  }

  @Get('schedules')
  @Header('Cache-Control', 'no-store')
  async schedules(@Req() request: FastifyRequest) {
    await this.authorize(request, 'groups.read');
    return this.forward('GET', '/api/v1/internal/director/schedules');
  }

  @Post('schedules')
  @Header('Cache-Control', 'no-store')
  async createSchedule(@Req() request: FastifyRequest, @Body() body: unknown) {
    const actor = await this.authorize(request, 'groups.update');
    const created = await this.forward('POST', '/api/v1/internal/director/schedules', body);
    await this.audit.recordFor(actor.id, 'Combos horarios', 'Guardó un combo horario.');
    return created;
  }

  @Delete('schedules/:id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async removeSchedule(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const actor = await this.authorize(request, 'groups.update');
    await this.forward('DELETE', `/api/v1/internal/director/schedules/${id}`);
    await this.audit.recordFor(actor.id, 'Combos horarios', 'Eliminó un combo horario.');
  }

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  async groups(@Req() request: FastifyRequest) {
    await this.authorize(request, 'groups.read');
    return this.forward('GET', '/api/v1/internal/director/groups');
  }

  @Post('groups')
  @Header('Cache-Control', 'no-store')
  async createGroup(@Req() request: FastifyRequest, @Body() body: unknown) {
    const actor = await this.authorize(request, 'groups.update');
    const created = await this.forward('POST', '/api/v1/internal/director/groups', body);
    const code = isRecord(created) && typeof created['code'] === 'string' ? created['code'] : 'un grupo';
    await this.audit.recordFor(actor.id, 'Grupos', `Creó el grupo ${code}.`);
    return created;
  }

  @Patch('groups/:id')
  @Header('Cache-Control', 'no-store')
  async updateGroup(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const actor = await this.authorize(request, 'groups.update');
    const updated = await this.forward('PATCH', `/api/v1/internal/director/groups/${id}`, body);
    await this.audit.recordFor(actor.id, 'Grupos', 'Actualizó un grupo.');
    return updated;
  }

  @Patch('groups/:id/reschedule')
  @Header('Cache-Control', 'no-store')
  async reschedule(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const actor = await this.authorize(request, 'groups.update');
    const updated = await this.forward('PATCH', `/api/v1/internal/director/groups/${id}/reschedule`, body);
    await this.audit.recordFor(actor.id, 'Grupos', 'Reprogramó un grupo.');
    return updated;
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private async forward(method: string, path: string, body?: unknown): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const upstream = process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}${path}`, {
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
