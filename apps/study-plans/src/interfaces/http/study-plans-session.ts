import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

import { SessionAccess } from '../../../../../libs/common/src/session-access.js';

export type StudyPlansRole = 'faculty' | 'teacher';

export interface StudyPlansActor {
  readonly id: string;
  readonly role: StudyPlansRole;
  readonly scopes: readonly string[];
}

interface AccessTokenPayload {
  readonly sub?: unknown;
  readonly csrf?: unknown;
  readonly applicationRoles?: unknown;
  readonly scopes?: unknown;
  readonly sid?: unknown;
  readonly sv?: unknown;
}

type AuthedRequest = FastifyRequest & { studyPlansActor?: StudyPlansActor };

const cookieToken = (request: FastifyRequest): string => {
  const value = request.cookies?.['ci_access'];
  return typeof value === 'string' ? value : '';
};

const headerCsrf = (request: FastifyRequest): string => {
  const value = request.headers['x-csrf-token'];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
};

export const resolveStudyPlansRole = (roles: readonly string[]): StudyPlansRole | null => {
  if (roles.includes('study-plans.faculty')) return 'faculty';
  if (roles.includes('study-plans.teacher')) return 'teacher';
  return null;
};

@Injectable()
export class StudyPlansSessionGuard implements CanActivate {
  private readonly access = SessionAccess.open();

  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = cookieToken(request);
    if (!token) throw new UnauthorizedException();
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || typeof payload.csrf !== 'string') throw new UnauthorizedException();
    if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') throw new UnauthorizedException();
    if (!(await this.access.allows(payload.sub, payload.sv, payload.sid))) throw new UnauthorizedException();
    if (request.method !== 'GET' && request.method !== 'HEAD' && headerCsrf(request) !== payload.csrf) {
      throw new ForbiddenException();
    }
    const roles = Array.isArray(payload.applicationRoles)
      ? payload.applicationRoles.filter((item): item is string => typeof item === 'string')
      : [];
    const role = resolveStudyPlansRole(roles);
    if (!role) throw new ForbiddenException();
    const scopes = Array.isArray(payload.scopes)
      ? payload.scopes.filter((item): item is string => typeof item === 'string' && /^[A-Z]{2,8}$/u.test(item))
      : [];
    request.studyPlansActor = { id: payload.sub, role, scopes };
    return true;
  }
}

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): StudyPlansActor => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  const actor = request.studyPlansActor;
  if (!actor) throw new UnauthorizedException();
  return actor;
});
