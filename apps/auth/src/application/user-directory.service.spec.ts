import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { AuditLogService } from './audit-log.service.js';
import { UserDirectoryService } from './user-directory.service.js';

describe('UserDirectoryService', () => {
  const count = vi.fn();
  const findMany = vi.fn();
  let service: UserDirectoryService;

  beforeEach(async () => {
    count.mockReset();
    findMany.mockReset();
    count.mockResolvedValue(1);
    const module = await Test.createTestingModule({
      providers: [UserDirectoryService, { provide: AuthPrismaService, useValue: { user: { count, findMany } } }],
    }).compile();
    service = module.get(UserDirectoryService);
  });

  it('returns only directory fields and keeps the page bounded', async () => {
    findMany.mockResolvedValue([{
      id: '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01',
      username: 'admin',
      status: 'ACTIVE',
      profile: { documentNumber: '123456', firstName: 'Ada', paternalLastName: 'Lima', maternalLastName: null },
      roles: [{ role: 'ADMINISTRATOR' }],
      passwordHash: 'should-not-escape',
      email: 'private@example.com',
    }]);
    const result = await service.list({ page: 2, pageSize: 5 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
    expect(result.total).toBe(1);
    expect(result.users).toEqual([{
      id: '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01',
      documentNumber: '123456',
      firstName: 'Ada',
      paternalLastName: 'Lima',
      maternalLastName: '',
      typeName: 'Administrador',
      roles: ['ADMINISTRATOR'],
    }]);
    expect(result.users[0]).not.toHaveProperty('email');
    expect(result.users[0]).not.toHaveProperty('passwordHash');
    expect(result.types.map((type) => type.name)).toEqual(['Estudiante', 'Docente', 'Asesora', 'Director', 'Administrador']);
  });

  it('escribe en el historial cuando el servicio de auditoría está registrado', async () => {
    const recordFor = vi.fn().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        UserDirectoryService,
        { provide: AuthPrismaService, useValue: {} },
        { provide: AuditLogService, useValue: { recordFor } },
      ],
    }).compile();
    const directory = module.get(UserDirectoryService);
    await directory['note']('actor-1', 'Modificó la cuenta de Jhon Livias.');
    expect(recordFor).toHaveBeenCalledWith('actor-1', 'Usuarios', 'Modificó la cuenta de Jhon Livias.');
  });

  it('filters by search, role, status and sede', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await service.list({
      page: 1,
      pageSize: 10,
      search: 'Ada',
      role: 'TEACHER',
      status: 'ACTIVE',
      siteId: '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02',
    });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        status: 'ACTIVE',
        siteId: '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02',
        roles: { some: { role: 'TEACHER' } },
      }),
    }));
  });
});
