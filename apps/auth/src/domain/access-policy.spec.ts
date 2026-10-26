import { describe, expect, it } from 'vitest';

import { accessPolicyCatalog, hasAccessPermission } from './access-policy.js';

describe('fixed access policy', () => {
  it('allows administrators to read the policy', () => {
    expect(hasAccessPermission(['ADMINISTRATOR'], 'access_policy.read')).toBe(true);
  });

  it('denies the policy to all other roles and users without roles', () => {
    for (const role of ['STUDENT', 'TEACHER', 'ADVISOR', 'DIRECTOR'] as const) {
      expect(hasAccessPermission([role], 'access_policy.read')).toBe(false);
    }
    expect(hasAccessPermission([], 'access_policy.read')).toBe(false);
  });

  it('lists five distinct fixed roles and the implemented permission', () => {
    const catalog = accessPolicyCatalog();
    expect(new Set(catalog.roles.map((role) => role.code)).size).toBe(5);
    expect(catalog.permissions.map((permission) => permission.code)).toEqual([
      'access_policy.read', 'users.read', 'users.create', 'users.update', 'users.delete', 'modules.read', 'audit.read', 'sites.read', 'sites.create', 'sites.update', 'sites.delete',
      'academic_config.read', 'academic_config.update',
      'permissions.read', 'permissions.create', 'permissions.update', 'permissions.delete',
    ]);
    expect(hasAccessPermission(['ADMINISTRATOR'], 'users.create')).toBe(true);
    expect(hasAccessPermission(['ADMINISTRATOR'], 'users.delete')).toBe(true);
    expect(hasAccessPermission(['DIRECTOR'], 'users.update')).toBe(false);
    expect(hasAccessPermission(['DIRECTOR'], 'users.delete')).toBe(false);
    expect(hasAccessPermission(['ADMINISTRATOR'], 'audit.read')).toBe(true);
    expect(hasAccessPermission(['DIRECTOR'], 'audit.read')).toBe(false);
    expect(hasAccessPermission(['ADMINISTRATOR'], 'academic_config.update')).toBe(true);
    expect(hasAccessPermission(['DIRECTOR'], 'academic_config.update')).toBe(false);
    expect(hasAccessPermission(['ADMINISTRATOR'], 'permissions.delete')).toBe(true);
    expect(hasAccessPermission(['DIRECTOR'], 'permissions.update')).toBe(false);
  });
});
