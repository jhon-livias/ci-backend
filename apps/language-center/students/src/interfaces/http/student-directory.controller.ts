import { Controller, Get, Header, Injectable, Query, ParseUUIDPipe, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { StudentDirectoryService } from '../../application/student-directory.service.js';

@Injectable()
export class InternalStudentsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!secret || secret.length < 32 || typeof supplied !== 'string') throw new UnauthorizedException();
    const a = Buffer.from(secret); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

@Controller('internal/students')
@UseGuards(InternalStudentsGuard)
export class StudentDirectoryController {
  constructor(private readonly students: StudentDirectoryService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  ensure(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.students.ensure(userId);
  }
}
