import { Controller, Get, Header, Injectable, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { FollowUpService } from '../../application/follow-up.service.js';

@Injectable()
export class InternalAttendanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!secret || secret.length < 32 || typeof supplied !== 'string') throw new UnauthorizedException();
    const a = Buffer.from(secret); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

@Controller('internal/follow-up')
@UseGuards(InternalAttendanceGuard)
export class FollowUpController {
  constructor(private readonly followUp: FollowUpService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read() {
    return this.followUp.read();
  }
}
