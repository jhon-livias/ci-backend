import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { PermissionCatalogService } from './permission-catalog.service.js';

interface StoredFunctionality { name: string; position: number }
interface StoredPermission {
  id: string;
  moduleCode: string;
  name: string;
  enabled: boolean;
  deletedAt: Date | null;
  functionalities: StoredFunctionality[];
}

const memory = () => {
  const rows: StoredPermission[] = [];
  let sequence = 0;
  const activeName = (row: StoredPermission) => rows.some((candidate) => candidate !== row && !candidate.deletedAt && candidate.moduleCode === row.moduleCode && candidate.name === row.name);
  const present = (row: StoredPermission) => ({ ...row, functionalities: [...row.functionalities] });
  const matches = (row: StoredPermission, where: { deletedAt: null; moduleCode?: string; OR?: readonly [{ name: { contains: string } }, { functionalities: { some: { name: { contains: string } } } }] }) => {
    if (row.deletedAt !== null) return false;
    if (where.moduleCode && row.moduleCode !== where.moduleCode) return false;
    const search = where.OR?.[0].name.contains.toLocaleLowerCase('es');
    if (!search) return true;
    return row.name.toLocaleLowerCase('es').includes(search) || row.functionalities.some((item) => item.name.toLocaleLowerCase('es').includes(search));
  };
  const api = {
    permissionDefinition: {
      count: async ({ where }: { where: Parameters<typeof matches>[1] }) => rows.filter((row) => matches(row, where)).length,
      findMany: async ({ where, skip, take }: { where: Parameters<typeof matches>[1]; skip: number; take: number }) =>
        rows.filter((row) => matches(row, where)).sort((left, right) => left.name.localeCompare(right.name, 'es') || left.id.localeCompare(right.id)).slice(skip, skip + take).map(present),
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
        const row = rows.find((candidate) => candidate.id === where.id && !candidate.deletedAt);
        return row ? present(row) : null;
      },
      create: async ({ data }: { data: { moduleCode: string; name: string; enabled: boolean; functionalities: { create: StoredFunctionality[] } } }) => {
        const row: StoredPermission = { id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, moduleCode: data.moduleCode, name: data.name, enabled: data.enabled, deletedAt: null, functionalities: data.functionalities.create };
        if (activeName(row)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        rows.push(row);
        return present(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: { moduleCode: string; name: string; enabled: boolean; functionalities?: { create: StoredFunctionality[] } } }) => {
        const row = rows.find((candidate) => candidate.id === where.id && !candidate.deletedAt);
        if (!row) throw new Error('missing');
        row.moduleCode = data.moduleCode;
        row.name = data.name;
        row.enabled = data.enabled;
        if (data.functionalities) row.functionalities = data.functionalities.create;
        if (activeName(row)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        return present(row);
      },
      updateMany: async ({ where, data }: { where: { id: string; deletedAt: null }; data: { enabled: boolean; deletedAt: Date } }) => {
        const row = rows.find((candidate) => candidate.id === where.id && !candidate.deletedAt);
        if (!row) return { count: 0 };
        row.enabled = data.enabled;
        row.deletedAt = data.deletedAt;
        return { count: 1 };
      },
    },
    $transaction: async <T>(callback: (client: typeof api) => Promise<T>) => callback(api),
  };
  return api;
};

describe('PermissionCatalogService', () => {
  const service = () => new PermissionCatalogService(memory() as unknown as AuthPrismaService);

  it('stores a permission and finds it by functionality', async () => {
    const catalog = service();
    const created = await catalog.create({ moduleCode: 'estudiante', name: 'Registro Programas', enabled: true, functionalities: [{ name: 'Funcionalidad 1', enabled: true }, { name: 'Funcionalidad 2', enabled: true }] });
    const page = await catalog.list({ module: 'estudiante', search: 'funcionalidad 2', page: 1, pageSize: 5 });
    expect(page.total).toBe(1);
    expect(page.items[0]).toEqual(created);
    expect(page.modules[0]).toEqual({ code: 'estudiante', name: 'Estudiante' });
  });

  it('rejects a duplicate name and hides a deleted permission', async () => {
    const catalog = service();
    const created = await catalog.create({ moduleCode: 'estudiante', name: 'Control total', enabled: true, functionalities: [{ name: 'Total', enabled: true }] });
    await expect(catalog.create({ moduleCode: 'estudiante', name: 'Control total', enabled: false, functionalities: [{ name: 'Total', enabled: true }] })).rejects.toBeInstanceOf(ConflictException);
    await catalog.remove(created.id);
    await expect(catalog.list({ page: 1, pageSize: 5 })).resolves.toMatchObject({ total: 0, items: [] });
    await expect(catalog.remove(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes only the enabled state without rewriting functionalities', async () => {
    const catalog = service();
    const created = await catalog.create({ moduleCode: 'estudiante', name: 'Control total', enabled: true, functionalities: [{ name: 'Total', enabled: true }] });
    const updated = await catalog.update(created.id, { enabled: false });
    expect(updated).toMatchObject({ enabled: false, functionalities: [{ name: 'Total', enabled: true }] });
  });
});
