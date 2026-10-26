import { describe, expect, it } from 'vitest';

import { normalizeUserType, UserTypeRuleError } from './user-type-catalog.js';

const permissionId = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a10';
const otherId = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a11';

describe('user type catalog rules', () => {
  it('accepts a name with at least one permission', () => {
    expect(normalizeUserType({
      name: 'Registrador',
      enabled: true,
      permissions: [
        { id: permissionId, enabled: true },
        { id: otherId, enabled: false },
      ],
    }).permissions.map((item) => item.enabled)).toEqual([true, false]);
  });

  it('rejects an unknown permission id and a type without access', () => {
    expect(() => normalizeUserType({ name: 'Registrador', enabled: true, permissions: [{ id: 'pagos', enabled: true }] })).toThrow(UserTypeRuleError);
    expect(() => normalizeUserType({ name: 'Registrador', enabled: true, permissions: [{ id: permissionId, enabled: false }] })).toThrow(UserTypeRuleError);
  });
});
