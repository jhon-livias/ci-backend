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
    expect(catalog.permissions.map((permission) => permission.code)).toEqual(['access_policy.read', 'users.read', 'modules.read', 'sites.read', 'sites.create', 'sites.update', 'sites.delete']);
  });
});
