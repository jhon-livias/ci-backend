import { Injectable } from '@nestjs/common';

import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';

const PAGE_SIZE = 20;

@Injectable()
export class UserDirectoryService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async list(page: number) {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true, username: true, status: true,
        profile: { select: { firstName: true, paternalLastName: true } },
        roles: { select: { role: true } },
      },
    });
    return {
      page,
      hasMore: users.length > PAGE_SIZE,
      users: users.slice(0, PAGE_SIZE).map((user) => ({
        id: user.id,
        username: user.username,
        status: user.status,
        displayName: user.profile ? `${user.profile.firstName} ${user.profile.paternalLastName}` : null,
        roles: user.roles.map(({ role }) => role),
      })),
    };
  }
}
