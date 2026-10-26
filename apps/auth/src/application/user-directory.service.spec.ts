import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { UserDirectoryService } from './user-directory.service.js';

describe('UserDirectoryService', () => {
  const findMany = vi.fn();
  let service: UserDirectoryService;

  beforeEach(async () => {
    findMany.mockReset();
    const module = await Test.createTestingModule({
      providers: [UserDirectoryService, { provide: AuthPrismaService, useValue: { user: { findMany } } }],
    }).compile();
    service = module.get(UserDirectoryService);
  });

  it('returns only allowed fields and bounds the page size', async () => {
    findMany.mockResolvedValue([{ id: 'id', username: 'admin', status: 'ACTIVE',
      profile: { firstName: 'Ada', paternalLastName: 'Lima' }, roles: [{ role: 'ADMINISTRATOR' }],
      passwordHash: 'should-not-escape', email: 'private@example.com' }]);
    const result = await service.list(2);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 21 }));
    expect(result).toEqual({ page: 2, hasMore: false, users: [{ id: 'id', username: 'admin',
      status: 'ACTIVE', displayName: 'Ada Lima', roles: ['ADMINISTRATOR'] }] });
  });

  it('does not return the extra record used to detect the next page', async () => {
    findMany.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({
      id: String(index), username: `u${index}`, status: 'ACTIVE', profile: null, roles: [],
    })));
    const result = await service.list(1);
    expect(result.hasMore).toBe(true);
    expect(result.users).toHaveLength(20);
  });
});
