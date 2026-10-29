import { describe, expect, it, vi } from 'vitest';

import { SsoService } from './sso.service.js';

const activeUser = {
  id: 'ea91d482-d8d2-4d53-a669-09b7fdcfcb99',
  username: 'ana',
  email: 'ana@uprit.edu.pe',
  status: 'ACTIVE',
  deletedAt: null,
  profile: { firstName: 'Ana', paternalLastName: 'Ramos' },
  applicationRoles: [{ applicationRole: { enabled: true, applicationId: 'app-id', code: 'TICKETS_REQUESTER' } }],
};

describe('SsoService', () => {
  it('emite un código de un solo uso y devuelve únicamente roles de Tickets', async () => {
    const prisma = {
      identityApplication: { findUnique: vi.fn().mockResolvedValue({ id: 'app-id', enabled: true }) },
      ssoAuthorizationCode: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({
          id: 'code-id', usedAt: null, expiresAt: new Date(Date.now() + 60_000), redirectUri: 'http://localhost:4201/auth/callback',
          codeChallenge: 'r'.repeat(43), applicationId: 'app-id',
          application: { code: 'ci-tickets', enabled: true }, user: activeUser,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new SsoService(prisma as never);
    const code = await service.authorize({
      user: { id: activeUser.id, username: 'ana', roles: [], mustChangePassword: false, profile: null },
      clientId: 'ci-tickets', redirectUri: 'http://localhost:4201/auth/callback', codeChallenge: 'r'.repeat(43),
    });
    expect(code).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
    expect(prisma.ssoAuthorizationCode.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ codeHash: expect.stringMatching(/^[a-f0-9]{64}$/u) }),
    }));
  });

  it('rechaza un canje cuando el PKCE no coincide', async () => {
    const prisma = {
      ssoAuthorizationCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'code-id', usedAt: null, expiresAt: new Date(Date.now() + 60_000), redirectUri: 'http://localhost:4201/auth/callback',
          codeChallenge: 'x'.repeat(43), applicationId: 'app-id',
          application: { code: 'ci-tickets', enabled: true }, user: activeUser,
        }),
        updateMany: vi.fn(),
      },
    };
    const service = new SsoService(prisma as never);
    await expect(service.exchange({
      clientId: 'ci-tickets', code: 'c'.repeat(43), redirectUri: 'http://localhost:4201/auth/callback', codeVerifier: 'v'.repeat(43),
    })).rejects.toThrow('verificación PKCE');
    expect(prisma.ssoAuthorizationCode.updateMany).not.toHaveBeenCalled();
  });
});
