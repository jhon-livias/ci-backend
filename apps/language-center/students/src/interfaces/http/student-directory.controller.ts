import { Controller, Get, Header, Injectable, Query, ParseUUIDPipe, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { internalSecretMatches } from '../../../../../../libs/common/src/internal-secret.js';

import { StudentDirectoryService } from '../../application/student-directory.service.js';

@Injectable()
export class InternalStudentsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!internalSecretMatches('students', supplied)) throw new UnauthorizedException();
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
