import { Injectable } from '@nestjs/common';

import { AUDIT_MODULES, AUDIT_ROLE_NAMES, cleanAuditText, isAuditModule, isAuditRoleName, roleLabel, type AuditModule } from '../domain/audit-log.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';

const SORT_FIELDS = ['occurredAt', 'actorName', 'actorRole', 'module', 'action'] as const;
type AuditSort = (typeof SORT_FIELDS)[number];

export interface AuditListQuery {
  readonly search?: string;
  readonly role?: string;
  readonly module?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly direction?: 'asc' | 'desc';
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async recordFor(actorId: string, module: AuditModule, action: string): Promise<void> {
    const text = cleanAuditText(action, 240);
    if (!text || !isAuditModule(module)) return;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          username: true,
          profile: { select: { firstName: true, paternalLastName: true } },
          roles: { select: { role: true } },
        },
      });
      if (!user) return;
      const actorName = cleanAuditText(user.profile ? `${user.profile.firstName} ${user.profile.paternalLastName}` : user.username, 200);
      const actorRole = roleLabel(user.roles.map((row) => row.role));
      if (!actorName || actorRole.length > 32) return;
      await this.prisma.auditEvent.create({
        data: { actorId: user.id, actorName, actorRole, module, action: text },
      });
    } catch {
      return;
    }
  }

  async list(query: AuditListQuery) {
    const pageSize = query.pageSize === 10 || query.pageSize === 20 ? query.pageSize : 5;
    const search = cleanAuditText(query.search ?? '', 80);
    const role = query.role && isAuditRoleName(query.role) ? query.role : undefined;
    const module = query.module && isAuditModule(query.module) ? query.module : undefined;
    const sort: AuditSort = SORT_FIELDS.find((field) => field === query.sort) ?? 'occurredAt';
    const direction = query.sort ? (query.direction === 'asc' ? 'asc' : 'desc') : 'desc';
    const where = {
      ...(role ? { actorRole: role } : {}),
      ...(module ? { module } : {}),
      ...(search
        ? {
            OR: [
              { actorName: { contains: search, mode: 'insensitive' as const } },
              { action: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: [{ [sort]: direction }, { id: direction }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        select: { id: true, occurredAt: true, actorName: true, actorRole: true, module: true, action: true },
      }),
    ]);
    return {
      page: query.page,
      pageSize,
      total,
      roles: AUDIT_ROLE_NAMES,
      modules: AUDIT_MODULES,
      events: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actorName: row.actorName,
        actorRole: row.actorRole,
        module: row.module,
        action: row.action,
      })),
    };
  }
}
