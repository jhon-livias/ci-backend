import { describe, expect, it } from 'vitest';

import { FIXED_ROLES } from './access-policy.js';
import { AUDIT_ROLE_NAMES, cleanAuditText, roleLabel } from './audit-log.js';

describe('audit log text', () => {
  it('keeps the role names aligned with the fixed roles', () => {
    expect(AUDIT_ROLE_NAMES).toEqual(FIXED_ROLES.map((role) => role.name));
  });

  it('drops markup and extra spaces from the stored sentence', () => {
    expect(cleanAuditText('  Creó  la  cuenta  de  <Ada>  ', 240)).toBe('Creó la cuenta de Ada');
  });

  it('uses the highest fixed role when an account has more than one', () => {
    expect(roleLabel(['STUDENT', 'ADMINISTRATOR'])).toBe('Administrador');
    expect(roleLabel([])).toBe('Usuario');
  });
});
