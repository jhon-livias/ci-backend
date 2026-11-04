import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type Type,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

import { resolveTicketsRole, type TicketsRole } from '../../domain/tickets-role.js';

export interface TicketsActor {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly documentNumber: string;
  readonly role: TicketsRole;
}

interface AccessTokenPayload {
  readonly sub?: unknown;
  readonly csrf?: unknown;
  readonly username?: unknown;
  readonly displayName?: unknown;
  readonly documentNumber?: unknown;
  readonly applicationRoles?: unknown;
}

type AuthedRequest = FastifyRequest & { ticketsActor?: TicketsActor };

const cookieToken = (request: FastifyRequest): string => {
  const value = request.cookies?.['ci_access'];
  return typeof value === 'string' ? value : '';
};

const headerCsrf = (request: FastifyRequest): string => {
  const value = request.headers['x-csrf-token'];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
};

@Injectable()
export class TicketsSessionGuard implements CanActivate {
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
    if (request.method !== 'GET' && request.method !== 'HEAD' && headerCsrf(request) !== payload.csrf) {
      throw new ForbiddenException();
    }
    const username = typeof payload.username === 'string' ? payload.username : '';
    const roles = Array.isArray(payload.applicationRoles)
      ? payload.applicationRoles.filter((item): item is string => typeof item === 'string')
      : [];
    request.ticketsActor = {
      id: payload.sub,
      username,
      displayName: typeof payload.displayName === 'string' && payload.displayName ? payload.displayName : username || 'Usuario',
      documentNumber: typeof payload.documentNumber === 'string' ? payload.documentNumber : '',
      role: resolveTicketsRole(roles, username),
    };
    return true;
  }
}

export const CurrentTicketsActor = createParamDecorator((_data: unknown, context: ExecutionContext): TicketsActor => {
  const actor = context.switchToHttp().getRequest<AuthedRequest>().ticketsActor;
  if (!actor) throw new UnauthorizedException();
  return actor;
});

export const TicketsRolesGuard = (...allowed: readonly TicketsRole[]): Type<CanActivate> => {
  @Injectable()
  class RoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const actor = context.switchToHttp().getRequest<AuthedRequest>().ticketsActor;
      if (!actor) throw new UnauthorizedException();
      if (!allowed.includes(actor.role)) throw new ForbiddenException();
      return true;
    }
  }
  return RoleGuard;
};
