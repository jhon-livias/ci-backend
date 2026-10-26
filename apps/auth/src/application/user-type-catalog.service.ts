import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { AuditLogService } from './audit-log.service.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { permissionModules } from '../domain/permission-catalog.js';
import { normalizeUserType, normalizeUserTypeName, UserTypeRuleError } from '../domain/user-type-catalog.js';

export interface UserTypeListQuery {
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface UserTypePermissionWrite {
  readonly id: string;
  readonly enabled: boolean;
}

export interface UserTypeWrite {
  readonly name: string;
  readonly permissions: readonly UserTypePermissionWrite[];
}

export interface UserTypePatch {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly permissions?: readonly UserTypePermissionWrite[];
}

const selection = {
  id: true,
  name: true,
  moduleCode: true,
  enabled: true,
  permissions: { select: { name: true, position: true }, orderBy: { position: 'asc' as const } },
  modules: { select: { moduleCode: true, enabled: true, position: true }, orderBy: { position: 'asc' as const } },
} as const;

@Injectable()
export class UserTypeCatalogService {
  constructor(
    private readonly prisma: AuthPrismaService,
    @Optional() private readonly audit: AuditLogService | null = null,
  ) {}

  async list(query: UserTypeListQuery) {
    const where = this.where(query);
    const [total, rows, catalog] = await Promise.all([
      this.prisma.userTypeDefinition.count({ where }),
      this.prisma.userTypeDefinition.findMany({
        where,
        select: selection,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.permissionRows(),
    ]);
    return {
      modules: permissionModules(),
      catalog: catalog.map((row) => ({ id: row.id, name: row.name })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: rows.map((row) => present(row)),
    };
  }

  async create(dto: UserTypeWrite, actorId?: string) {
    const draft = this.normalize({ name: dto.name, enabled: true, permissions: dto.permissions });
    const resolved = await this.resolvePermissions(draft.permissions);
    try {
      const created = await this.prisma.userTypeDefinition.create({
        data: {
          name: draft.name,
          moduleCode: resolved.moduleCode,
          enabled: true,
          modules: { create: resolved.modules.map((moduleCode, position) => ({ moduleCode, enabled: true, position })) },
          permissions: { create: resolved.names.map((name, position) => ({ name, position })) },
        },
        select: selection,
      });
      const detail = present(created);
      if (actorId) await this.audit?.recordFor(actorId, 'Tipos de usuario', `Creó el tipo de usuario ${detail.name}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async update(id: string, dto: UserTypePatch, actorId?: string) {
    if (dto.name === undefined && dto.enabled === undefined && dto.permissions === undefined) {
      throw new BadRequestException('No se pudo guardar el tipo de usuario.');
    }
    try {
      const detail = await this.prisma.$transaction(async (tx) => {
        const current = await tx.userTypeDefinition.findFirst({ where: { id, deletedAt: null }, select: selection });
        if (!current) throw new NotFoundException();
        const name = this.readableName(dto.name ?? current.name);
        const enabled = dto.enabled ?? current.enabled;
        const resolved = dto.permissions ? await this.resolvePermissions(this.normalize({ name, enabled, permissions: dto.permissions }).permissions) : null;
        const updated = await tx.userTypeDefinition.update({
          where: { id },
          data: {
            name,
            enabled,
            ...(resolved
              ? {
                  moduleCode: resolved.moduleCode,
                  modules: { deleteMany: {}, create: resolved.modules.map((moduleCode, position) => ({ moduleCode, enabled: true, position })) },
                  permissions: { deleteMany: {}, create: resolved.names.map((permissionName, position) => ({ name: permissionName, position })) },
                }
              : {}),
          },
          select: selection,
        });
        return present(updated);
      });
      if (actorId) await this.audit?.recordFor(actorId, 'Tipos de usuario', `Modificó el tipo de usuario ${detail.name}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const current = await this.prisma.userTypeDefinition.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
    const result = await this.prisma.userTypeDefinition.updateMany({
      where: { id, deletedAt: null },
      data: { enabled: false, deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException();
    if (actorId && current) await this.audit?.recordFor(actorId, 'Tipos de usuario', `Eliminó el tipo de usuario ${current.name}.`);
  }

  private async permissionRows() {
    const rows = await this.prisma.permissionDefinition.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, moduleCode: true, createdAt: true },
    });
    const order = new Map<string, number>(permissionModules().map((module, index) => [module.code, index]));
    return [...rows].sort((left, right) => (order.get(left.moduleCode) ?? 0) - (order.get(right.moduleCode) ?? 0) || left.createdAt.getTime() - right.createdAt.getTime());
  }

  private async resolvePermissions(items: readonly UserTypePermissionWrite[]) {
    const enabled = new Set(items.filter((item) => item.enabled).map((item) => item.id));
    const rows = (await this.permissionRows()).filter((row) => enabled.has(row.id.toLowerCase()));
    if (rows.length !== enabled.size) throw new BadRequestException('No se pudo guardar el tipo de usuario.');
    const seen = new Set<string>();
    const selected = rows.filter((row) => {
      const key = row.name.toLocaleLowerCase('es');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const modules: string[] = [];
    for (const row of selected) {
      if (!modules.includes(row.moduleCode)) modules.push(row.moduleCode);
    }
    const moduleCode = modules[0];
    if (!moduleCode) throw new BadRequestException('No se pudo guardar el tipo de usuario.');
    return { names: selected.map((row) => row.name), moduleCode, modules };
  }

  private where(query: UserTypeListQuery) {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { permissions: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
  }

  private normalize(input: { name: string; enabled: boolean; permissions: readonly UserTypePermissionWrite[] }) {
    try {
      return normalizeUserType(input);
    } catch (error) {
      if (error instanceof UserTypeRuleError) throw new BadRequestException('No se pudo guardar el tipo de usuario.');
      throw error;
    }
  }

  private readableName(name: string): string {
    try {
      return normalizeUserTypeName(name);
    } catch (error) {
      if (error instanceof UserTypeRuleError) throw new BadRequestException('No se pudo guardar el tipo de usuario.');
      throw error;
    }
  }

  private rethrowPersistence(error: unknown): never {
    if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Ese tipo de usuario ya está registrado.');
    }
    throw error;
  }
}

const present = (row: {
  id: string;
  name: string;
  moduleCode: string;
  enabled: boolean;
  permissions: readonly { name: string; position: number }[];
  modules: readonly { moduleCode: string; enabled: boolean; position: number }[];
}) => {
  const catalog = permissionModules();
  const stored = new Map(row.modules.map((item) => [item.moduleCode, item.enabled]));
  const access = catalog.map((module) => ({ code: module.code, name: module.name, enabled: stored.get(module.code) ?? (row.modules.length === 0 && module.code === row.moduleCode) }));
  const enabledNames = access.filter((item) => item.enabled).map((item) => item.name);
  return {
    id: row.id,
    name: row.name,
    moduleCode: row.moduleCode,
    moduleName: enabledNames.join(' - ') || catalog.find((module) => module.code === row.moduleCode)?.name || row.moduleCode,
    enabled: row.enabled,
    permissions: [...row.permissions].sort((left, right) => left.position - right.position).map((item) => item.name),
    access,
  };
};
