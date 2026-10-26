import { Injectable } from '@nestjs/common';

import { presentModuleDirectory, type DirectoryModuleQuery } from '../domain/system-modules.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { UserStatus } from '../infrastructure/persistence/generated/client.js';

@Injectable()
export class ModuleDirectoryService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async list(query: Omit<DirectoryModuleQuery, 'pageSize'> & { pageSize: number }) {
    const pageSize = query.pageSize === 10 || query.pageSize === 20 ? query.pageSize : 5;
    const roles = await this.prisma.userRole.findMany({
      where: { user: { deletedAt: null } },
      select: { role: true, user: { select: { status: true } } },
    });
    const counts = new Map<string, { active: number; inactive: number }>();
    for (const row of roles) {
      const current = counts.get(row.role) ?? { active: 0, inactive: 0 };
      if (row.user.status === UserStatus.ACTIVE) current.active += 1;
      else current.inactive += 1;
      counts.set(row.role, current);
    }
    return presentModuleDirectory([...counts].map(([role, count]) => ({ role, ...count })), { ...query, pageSize });
  }
}
