import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationService } from '../../application/authentication.service.js';
import { AccessPolicyGuard, ModulesReadGuard, UsersReadGuard } from './access-policy.guard.js';

describe('AccessPolicyGuard', () => {
  const restore = vi.fn();
  let guard: AccessPolicyGuard;
  const context = (token?: string) => new ExecutionContextHost([{ cookies: token ? { ci_access: token } : {} }]);

  beforeEach(async () => {
    restore.mockReset();
    const module = await Test.createTestingModule({
      providers: [AccessPolicyGuard, UsersReadGuard, { provide: AuthenticationService, useValue: { restore } }],
    }).compile();
    guard = module.get(AccessPolicyGuard);
  });

  it('rejects requests without a session', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(restore).not.toHaveBeenCalled();
  });

  it('rejects invalid sessions', async () => {
    restore.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(context('invalid'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects authenticated users without the permission', async () => {
    restore.mockResolvedValue({ user: { roles: ['TEACHER'] } });
    await expect(guard.canActivate(context('valid'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an active administrator returned by the session service', async () => {
    restore.mockResolvedValue({ user: { roles: ['ADMINISTRATOR'] } });
    await expect(guard.canActivate(context('valid'))).resolves.toBe(true);
  });

  it('denies directory access to a non-administrator', async () => {
    const module = await Test.createTestingModule({
      providers: [UsersReadGuard, { provide: AuthenticationService, useValue: { restore } }],
    }).compile();
    restore.mockResolvedValue({ user: { roles: ['DIRECTOR'] } });
    await expect(module.get(UsersReadGuard).canActivate(context('valid'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects the module catalog from unauthenticated and non-administrator requests', async () => {
    const module = await Test.createTestingModule({
      providers: [ModulesReadGuard, { provide: AuthenticationService, useValue: { restore } }],
    }).compile();
    const modulesGuard = module.get(ModulesReadGuard);
    await expect(modulesGuard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    restore.mockResolvedValue({ user: { roles: ['STUDENT'] } });
    await expect(modulesGuard.canActivate(context('valid'))).rejects.toBeInstanceOf(ForbiddenException);
    restore.mockResolvedValue({ user: { roles: ['ADMINISTRATOR'] } });
    await expect(modulesGuard.canActivate(context('valid'))).resolves.toBe(true);
  });
});
