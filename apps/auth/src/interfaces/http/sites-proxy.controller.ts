import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, HttpException, Inject, Optional, Param, ParseUUIDPipe, Post, Put, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { FastifyRequest } from 'fastify';
import { SiteDto } from '../../../../../libs/contracts/src/site.dto.js';
import { AuditLogService } from '../../application/audit-log.service.js';
import { AuthenticationService, type AuthenticatedUser } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

class GeographyQueryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/^\d{3}$|^\d{5}$/)
  code!: string;
}

@Controller('auth/admin/sites')
export class SitesProxyController {
  constructor(
    private readonly auth: AuthenticationService,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
  ) {}

  @Get() @Header('Cache-Control', 'no-store') async list(@Req() req: FastifyRequest) { await this.authorize(req, 'sites.read'); return this.forward('GET'); }
  @Get('geography/departments') async departments(@Req() req: FastifyRequest) { await this.authorize(req, 'sites.read'); return this.forward('GET', 'geography/departments'); }
  @Get('geography/provinces') async provinces(@Req() req: FastifyRequest, @Query() query: GeographyQueryDto) { await this.authorize(req, 'sites.read'); return this.forward('GET', `geography/provinces?code=${encodeURIComponent(query.code)}`); }
  @Get('geography/districts') async districts(@Req() req: FastifyRequest, @Query() query: GeographyQueryDto) { await this.authorize(req, 'sites.read'); return this.forward('GET', `geography/districts?code=${encodeURIComponent(query.code)}`); }
  @Get(':id') @Header('Cache-Control', 'no-store') async detail(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) { await this.authorize(req, 'sites.read'); return this.forward('GET', id); }
  @Post() async create(@Req() req: FastifyRequest, @Body() dto: SiteDto) {
    const actor = await this.authorize(req, 'sites.create');
    const created = await this.forward('POST', undefined, dto);
    await this.audit?.recordFor(actor.id, 'Sedes', `Creó la sede ${dto.name}.`);
    return created;
  }
  @Put(':id') async update(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteDto) {
    const actor = await this.authorize(req, 'sites.update');
    const updated = await this.forward('PUT', id, dto);
    await this.audit?.recordFor(actor.id, 'Sedes', `Modificó la sede ${dto.name}.`);
    return updated;
  }
  @Delete(':id') @HttpCode(204) async remove(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const actor = await this.authorize(req, 'sites.delete');
    const current = await this.forward('GET', id);
    await this.forward('DELETE', id);
    await this.audit?.recordFor(actor.id, 'Sedes', `Eliminó la sede ${this.siteName(current)}.`);
  }

  private async authorize(req: FastifyRequest, permission: AccessPermission): Promise<AuthenticatedUser> {
    const token = req.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private siteName(value: unknown): string {
    if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && value.name.trim()) return value.name.trim();
    return 'sin nombre';
  }

  private async forward(method: string, path?: string, dto?: SiteDto): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const upstream = process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}/api/v1/internal/sites${path ? `/${path}` : ''}`, {
        method, headers: { 'x-internal-secret': secret, ...(dto ? { 'content-type': 'application/json' } : {}) },
        ...(dto ? { body: JSON.stringify(dto) } : {}), signal: AbortSignal.timeout(5000),
      });
    } catch { throw new ServiceUnavailableException(); }
    if (!response.ok) {
      if ([400, 404, 409].includes(response.status)) throw new HttpException('No se pudo completar la operación.', response.status);
      throw new ServiceUnavailableException();
    }
    return response.status === 204 ? undefined : await response.json();
  }
}
