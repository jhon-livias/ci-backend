import { describe, expect, it } from 'vitest';

import { normalizePermission, PermissionRuleError } from './permission-catalog.js';

const valid = {
  moduleCode: 'estudiante',
  name: 'Registro Programas',
  enabled: true,
  functionalities: ['Funcionalidad 1', 'Funcionalidad 2'],
};

describe('permission catalog rules', () => {
  it('accepts a plain-text permission of a known module', () => {
    expect(normalizePermission(valid).functionalities).toEqual(['Funcionalidad 1', 'Funcionalidad 2']);
  });

  it('rejects unknown modules, markup and repeated functionalities', () => {
    expect(() => normalizePermission({ ...valid, moduleCode: 'pagos' })).toThrow(PermissionRuleError);
    expect(() => normalizePermission({ ...valid, name: '<b>Total</b>' })).toThrow(PermissionRuleError);
    expect(() => normalizePermission({ ...valid, functionalities: ['Total', 'total'] })).toThrow(PermissionRuleError);
  });
});
