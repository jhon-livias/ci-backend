import { describe, expect, it } from 'vitest';

import { presentModuleDirectory } from './system-modules.js';

describe('module directory', () => {
  it('counts active and inactive people and keeps the catalog order', () => {
    const page = presentModuleDirectory([
      { role: 'TEACHER', active: 132, inactive: 65 },
      { role: 'STUDENT', active: 3645, inactive: 34 },
      { role: 'ADMINISTRATOR', active: 1, inactive: 0 },
    ], { page: 1, pageSize: 5 });

    expect(page.total).toBe(5);
    expect(page.modules.map((module) => [module.name, module.users, module.active, module.inactive])).toEqual([
      ['Docente', 197, 132, 65],
      ['Alumnos', 3679, 3645, 34],
      ['Asesora', 0, 0, 0],
      ['Director', 0, 0, 0],
      ['Administrador', 1, 1, 0],
    ]);
  });

  it('filters by name and can hide empty modules', () => {
    const page = presentModuleDirectory([
      { role: 'STUDENT', active: 2, inactive: 0 },
    ], { search: 'alu', occupied: true, page: 1, pageSize: 5, sort: 'users', direction: 'desc' });

    expect(page.modules.map((module) => module.name)).toEqual(['Alumnos']);
  });
});
