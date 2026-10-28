import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AccountProfileService, normalizeAccountProfile } from './account-profile.service.js';

const valid = {
  gender: 'FEMALE' as const,
  birthDate: '1994-03-12',
  maritalStatus: 'SINGLE' as const,
  mobileCountry: '+51',
  mobile: '946869590',
  personalEmail: 'Ana@correo.com',
  address: 'Av. América 120',
};

describe('account profile', () => {
  it('normalizes the editable fields and rejects a future birth date', () => {
    expect(normalizeAccountProfile(valid).personalEmail).toBe('ana@correo.com');
    expect(() => normalizeAccountProfile({ ...valid, birthDate: '2099-01-01' })).toThrow(BadRequestException);
    expect(() => normalizeAccountProfile({ ...valid, address: '<b>calle</b>' })).toThrow(BadRequestException);
  });

  it('updates contact data and keeps the institutional email', async () => {
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi.fn().mockResolvedValue({
      email: 'ana@uprit.edu.pe',
      username: 'ana',
      status: 'ACTIVE',
      siteId: '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01',
      roles: [{ role: 'ADMINISTRATOR' }],
      profile: {
        documentType: 'DNI',
        documentNumber: '12345678',
        firstName: 'Ana',
        paternalLastName: 'Rojas',
        maternalLastName: 'Diaz',
        gender: null,
        birthDate: null,
        maritalStatus: null,
        mobileCountry: null,
        mobile: null,
        personalEmail: null,
        address: null,
      },
    });
    const service = new AccountProfileService(
      { user: { findFirst }, userProfile: { update } } as never,
      { recordFor: vi.fn() } as never,
    );
    const result = await service.update('user-1', valid);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
      data: expect.objectContaining({ personalEmail: 'ana@correo.com', mobile: '946869590' }),
    }));
    expect(result.email).toBe('ana@uprit.edu.pe');
    expect(result.typeName).toBe('Administrador');
    expect(result.birthDate).toBe('1994-03-12');
  });
});
