import { Body, Controller, ForbiddenException, Get, Header, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission } from '../../domain/access-policy.js';

@Controller('auth/advisor/follow-up')
export class FollowUpProxyController {
  constructor(private readonly auth: AuthenticationService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async read(@Req() request: FastifyRequest) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, 'attendance.read')) throw new ForbiddenException();
    const secret = process.env.SITES_INTERNAL_SECRET;
    const upstream = process.env.ATTENDANCE_GRADES_UPSTREAM ?? 'http://attendance-grades:3005';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}/api/v1/internal/follow-up`, {
        headers: { 'x-internal-secret': secret },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException();
    }
    if (!response.ok) throw new ServiceUnavailableException();
    return response.json();
  }

  @Get('absences')
  @Header('Cache-Control', 'no-store')
  async absences(@Req() request: FastifyRequest, @Query('query') query?: string, @Query('date') date?: string, @Query('status') status?: string) {
    await this.authorize(request, false);
    const params = new URLSearchParams(); if (query) params.set('query', query); if (date) params.set('date', date); if (status) params.set('status', status);
    return this.forward('GET', `/api/v1/internal/student-records/absences?${params}`);
  }

  @Post('absences/justify')
  @Header('Cache-Control', 'no-store')
  async justify(@Req() request: FastifyRequest, @Body() body: unknown) {
    const session = await this.authorize(request, true);
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
    return this.forward('POST', '/api/v1/internal/student-records/absences/justify', { ...input, actorId: session.user.id });
  }

  private async authorize(request: FastifyRequest, mutable: boolean) {
    const token = request.cookies?.['ci_access']; if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, 'attendance.read')) throw new ForbiddenException();
    if (mutable && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session;
  }

  private async forward(method: string, path: string, body?: unknown): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET; const upstream = process.env.ATTENDANCE_GRADES_UPSTREAM ?? 'http://attendance-grades:3005';
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    const response = await fetch(`${upstream}${path}`, { method, headers: { 'x-internal-secret': secret, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!response || !response.ok) throw new ServiceUnavailableException(); return response.json();
  }
}
