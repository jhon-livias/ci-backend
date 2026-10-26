import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticationService } from '../../application/authentication.service.js';
import { SitesProxyController } from './sites-proxy.controller.js';

describe('sites authorization', () => {
  afterEach(() => vi.unstubAllGlobals());
  const request = (token?: string, csrf?: string): FastifyRequest => ({ method: 'POST', cookies: token ? { ci_access: token } : {}, headers: { 'x-csrf-token': csrf } }) as FastifyRequest;
  const dto = { code: 'TRUJILLO', name: 'Trujillo', location: null, active: true };
  it('rejects requests without a session', async () => {
    const auth = { restore: vi.fn() } as unknown as AuthenticationService;
    await expect(new SitesProxyController(auth).create(request(), dto)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects users without permission and invalid CSRF', async () => {
    const restore = vi.fn().mockResolvedValueOnce({ user: { roles: ['TEACHER'] }, csrfToken: 'expected' }).mockResolvedValueOnce({ user: { roles: ['ADMINISTRATOR'] }, csrfToken: 'expected' });
    const controller = new SitesProxyController({ restore } as unknown as AuthenticationService);
    await expect(controller.create(request('token', 'expected'), dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create(request('token', 'wrong'), dto)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
