import { describe, expect, it } from 'vitest';

import { normalizeUserAccount, temporaryPassword, UserAccountRuleError } from './user-account.js';

const permissionId = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4a01';
const siteId = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02';

const draft = (overrides: Record<string, unknown> = {}) => ({
  documentType: 'DNI',
  documentNumber: '74034567',
  firstName: 'Carlos',
  paternalLastName: 'Haro',
  maternalLastName: 'Polo',
  siteId,
  phone: '',
  mobileCountry: '+51',
  mobile: '946869590',
  email: 'Carlos@uprit.edu.pe',
  password: 'clave-segura',
  enabled: true,
  grants: [{ permissionId, name: 'Seleccionar idioma', enabled: true }],
  ...overrides,
});

describe('user account rules', () => {
  it('normalizes a new account and lowercases the email', () => {
    const account = normalizeUserAccount(draft(), true);
    expect(account.email).toBe('carlos@uprit.edu.pe');
    expect(account.password).toBe('clave-segura');
    expect(account.phone).toBeNull();
  });

  it('allows an edit to keep the current password and an incomplete profile', () => {
    expect(normalizeUserAccount(draft({ password: ' ' }), false).password).toBeNull();
    const account = normalizeUserAccount(draft({ maternalLastName: '', siteId: '', mobile: '', grants: [] }), false);
    expect(account.maternalLastName).toBe('');
    expect(account.siteId).toBe('');
    expect(account.mobile).toBe('');
    expect(account.grants).toEqual([]);
  });

  it('builds a temporary password the account can store', () => {
    const password = temporaryPassword();
    expect(password).toMatch(/^[^<>]{8,72}$/u);
    expect(password).toMatch(/[A-Z]/u);
    expect(password).toMatch(/[a-z]/u);
    expect(password).toMatch(/[0-9]/u);
  });

  it('rejects an email outside the institutional domain', () => {
    expect(() => normalizeUserAccount(draft({ email: 'carlos@gmail.com' }), true)).toThrow(UserAccountRuleError);
    expect(() => normalizeUserAccount(draft({ email: 'carlos@uprit.edu.pe.evil.com' }), false)).toThrow(UserAccountRuleError);
  });

  it('rejects a short password, a DNI of the wrong length and an account without access', () => {
    expect(() => normalizeUserAccount(draft({ password: 'corta' }), true)).toThrow(UserAccountRuleError);
    expect(() => normalizeUserAccount(draft({ documentNumber: '1234' }), true)).toThrow(UserAccountRuleError);
    expect(() => normalizeUserAccount(draft({ grants: [{ permissionId, name: 'Seleccionar idioma', enabled: false }] }), true)).toThrow(UserAccountRuleError);
  });
});
