import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, HttpException, Param, ParseUUIDPipe, Post, Put, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { FastifyRequest } from 'fastify';
import { SiteDto } from '../../../../academic/src/interfaces/http/site.dto.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

class GeographyQueryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/^\d{3}$|^\d{5}$/)
  code!: string;
}

@Controller('auth/admin/sites')
export class SitesProxyController {
  constructor(private readonly auth: AuthenticationService) {}

  @Get() @Header('Cache-Control', 'no-store') async list(@Req() req: FastifyRequest) { await this.authorize(req, 'sites.read'); return this.forward('GET'); }
  @Get('geography/departments') async departments(@Req() req: FastifyRequest) { await this.authorize(req, 'sites.read'); return this.forward('GET', 'geography/departments'); }
  @Get('geography/provinces') async provinces(@Req() req: FastifyRequest, @Query() query: GeographyQueryDto) { await this.authorize(req, 'sites.read'); return this.forward('GET', `geography/provinces?code=${encodeURIComponent(query.code)}`); }
  @Get('geography/districts') async districts(@Req() req: FastifyRequest, @Query() query: GeographyQueryDto) { await this.authorize(req, 'sites.read'); return this.forward('GET', `geography/districts?code=${encodeURIComponent(query.code)}`); }
  @Get(':id') @Header('Cache-Control', 'no-store') async detail(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) { await this.authorize(req, 'sites.read'); return this.forward('GET', id); }
  @Post() async create(@Req() req: FastifyRequest, @Body() dto: SiteDto) { await this.authorize(req, 'sites.create'); return this.forward('POST', undefined, dto); }
  @Put(':id') async update(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteDto) { await this.authorize(req, 'sites.update'); return this.forward('PUT', id, dto); }
  @Delete(':id') @HttpCode(204) async remove(@Req() req: FastifyRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> { await this.authorize(req, 'sites.delete'); await this.forward('DELETE', id); }

  private async authorize(req: FastifyRequest, permission: AccessPermission): Promise<void> {
    const token = req.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
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
