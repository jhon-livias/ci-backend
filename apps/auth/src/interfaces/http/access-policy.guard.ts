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

  protected async authorize(context: ExecutionContext, permission: AccessPermission, requireCsrf = false): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const accessToken = request.cookies?.['ci_access'];
    if (!accessToken) throw new UnauthorizedException();
    const session = await this.authenticationService.restore(accessToken);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (requireCsrf) {
      const header = request.headers['x-csrf-token'];
      const csrf = Array.isArray(header) ? header[0] : header;
      if (csrf !== session.csrfToken) throw new ForbiddenException();
    }
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
export class UsersCreateGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'users.create', true);
  }
}

@Injectable()
export class UsersUpdateGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'users.update', true);
  }
}

@Injectable()
export class UsersDeleteGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'users.delete', true);
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

@Injectable()
export class AuditReadGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'audit.read');
  }
}

@Injectable()
export class PermissionsReadGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'permissions.read');
  }
}

@Injectable()
export class PermissionsCreateGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'permissions.create', true);
  }
}

@Injectable()
export class PermissionsUpdateGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'permissions.update', true);
  }
}

@Injectable()
export class PermissionsDeleteGuard extends AccessPolicyGuard {
  constructor(authenticationService: AuthenticationService) {
    super(authenticationService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authorize(context, 'permissions.delete', true);
  }
}
