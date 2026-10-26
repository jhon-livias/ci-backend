import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(private readonly authenticationService: AuthenticationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'access_policy.read');
  }

  protected async authorize(context: ExecutionContext, permission: AccessPermission): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const accessToken = request.cookies?.['ci_access'];
    if (!accessToken) throw new UnauthorizedException();
    const session = await this.authenticationService.restore(accessToken);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class UsersReadGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'users.read');
  }
}

@Injectable()
export class ModulesReadGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'modules.read');
  }
}
