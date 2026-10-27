import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { AuditLogService } from './audit-log.service.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { isPermissionModule, normalizePermission, PermissionRuleError, permissionModules } from '../domain/permission-catalog.js';

export interface PermissionListQuery {
  readonly module?: string;
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface PermissionFunctionalityWrite {
  readonly name: string;
  readonly enabled: boolean;
}

export interface PermissionWrite {
  readonly moduleCode: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly functionalities: readonly PermissionFunctionalityWrite[];
}

export interface PermissionPatch {
  readonly moduleCode?: string;
  readonly name?: string;
  readonly enabled?: boolean;
  readonly functionalities?: readonly PermissionFunctionalityWrite[];
}

const selection = {
  id: true,
  moduleCode: true,
  name: true,
  enabled: true,
  functionalities: { select: { name: true, position: true, enabled: true }, orderBy: { position: 'asc' as const } },
} as const;

@Injectable()
export class PermissionCatalogService {
  constructor(
    private readonly prisma: AuthPrismaService,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
  ) {}

  async list(query: PermissionListQuery) {
    if (query.module && !isPermissionModule(query.module)) throw new BadRequestException('No se pudo consultar los permisos.');
    const where = this.where(query);
    const [total, rows] = await Promise.all([
      this.prisma.permissionDefinition.count({ where }),
      this.prisma.permissionDefinition.findMany({
        where,
        select: selection,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      modules: permissionModules(),
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: rows.map(present),
    };
  }

  async create(dto: PermissionWrite, actorId?: string) {
    const draft = this.normalize(dto);
    try {
      const created = await this.prisma.permissionDefinition.create({
        data: {
          moduleCode: draft.moduleCode,
          name: draft.name,
          enabled: draft.enabled,
          functionalities: { create: draft.functionalities.map((item, position) => ({ name: item.name, position, enabled: item.enabled })) },
        },
        select: selection,
      });
      const detail = present(created);
      if (actorId) await this.audit?.recordFor(actorId, 'Permisos', `Creó el permiso ${detail.name}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async update(id: string, dto: PermissionPatch, actorId?: string) {
    if (dto.name === undefined && dto.enabled === undefined && dto.moduleCode === undefined && dto.functionalities === undefined) {
      throw new BadRequestException('No se pudo guardar el permiso.');
    }
    try {
      const detail = await this.prisma.$transaction(async (tx) => {
        const current = await tx.permissionDefinition.findFirst({ where: { id, deletedAt: null }, select: selection });
        if (!current) throw new NotFoundException();
        const draft = this.normalize({
          moduleCode: dto.moduleCode ?? current.moduleCode,
          name: dto.name ?? current.name,
          enabled: dto.enabled ?? current.enabled,
          functionalities: dto.functionalities ?? current.functionalities.map((item) => ({ name: item.name, enabled: item.enabled })),
        });
        const updated = await tx.permissionDefinition.update({
          where: { id },
          data: {
            moduleCode: draft.moduleCode,
            name: draft.name,
            enabled: draft.enabled,
            ...(dto.functionalities
              ? { functionalities: { deleteMany: {}, create: draft.functionalities.map((item, position) => ({ name: item.name, position, enabled: item.enabled })) } }
              : {}),
          },
          select: selection,
        });
        return present(updated);
      });
      if (actorId) await this.audit?.recordFor(actorId, 'Permisos', `Modificó el permiso ${detail.name}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const current = await this.prisma.permissionDefinition.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
    const result = await this.prisma.permissionDefinition.updateMany({
      where: { id, deletedAt: null },
      data: { enabled: false, deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException();
    if (actorId && current) await this.audit?.recordFor(actorId, 'Permisos', `Eliminó el permiso ${current.name}.`);
  }

  private where(query: PermissionListQuery) {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      ...(query.module ? { moduleCode: query.module } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { functionalities: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
  }

  private normalize(input: { moduleCode: string; name: string; enabled: boolean; functionalities: readonly PermissionFunctionalityWrite[] }) {
    try {
      const draft = normalizePermission({ ...input, functionalities: input.functionalities.map((item) => item.name) });
      return { ...draft, functionalities: draft.functionalities.map((name, index) => ({ name, enabled: input.functionalities[index]?.enabled ?? true })) };
    } catch (error) {
      if (error instanceof PermissionRuleError) throw new BadRequestException('No se pudo guardar el permiso.');
      throw error;
    }
  }

  private rethrowPersistence(error: unknown): never {
    if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
    if (isUniqueConflict(error)) throw new ConflictException('Ese permiso ya está registrado en el módulo.');
    throw error;
  }
}

const present = (row: {
  id: string;
  moduleCode: string;
  name: string;
  enabled: boolean;
  functionalities: readonly { name: string; position: number; enabled: boolean }[];
}) => ({
  id: row.id,
  moduleCode: row.moduleCode,
  name: row.name,
  enabled: row.enabled,
  functionalities: [...row.functionalities].sort((left, right) => left.position - right.position).map((item) => ({ name: item.name, enabled: item.enabled })),
});

const isUniqueConflict = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
