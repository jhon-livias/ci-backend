import { Controller, Get, Header, Injectable, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { internalSecretMatches } from '../../../../../../libs/common/src/internal-secret.js';

import { FollowUpService } from '../../application/follow-up.service.js';

@Injectable()
export class InternalAttendanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!internalSecretMatches('attendance', supplied)) throw new UnauthorizedException();
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
