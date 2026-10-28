import { Controller, ForbiddenException, Get, Header, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
}
