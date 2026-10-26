import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import * as argon2 from 'argon2';

import { FIXED_ROLES, type FixedRole } from '../domain/access-policy.js';
import { normalizeUserAccount, temporaryPassword, UserAccountRuleError, type NormalizedUserAccount } from '../domain/user-account.js';
import { AuditLogService } from './audit-log.service.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { UserRoleName } from '../infrastructure/persistence/generated/client.js';

const STATUSES = [
  { code: 'ACTIVE', name: 'Activo' },
  { code: 'INVITED', name: 'Invitado' },
  { code: 'SUSPENDED', name: 'Suspendido' },
  { code: 'LOCKED', name: 'Bloqueado' },
] as const;

const ROLE_ORDER = new Map<string, number>(FIXED_ROLES.map((role, index) => [role.code, index]));
const ROLE_NAMES = new Map<string, string>(FIXED_ROLES.map((role) => [role.code, role.name]));
const MODULE_ROLE: Readonly<Record<string, UserRoleName>> = {
  estudiante: UserRoleName.STUDENT,
  docente: UserRoleName.TEACHER,
  asesora: UserRoleName.ADVISOR,
  director: UserRoleName.DIRECTOR,
  administrador: UserRoleName.ADMINISTRATOR,
};

const detailSelection = {
  id: true,
  email: true,
  status: true,
  siteId: true,
  profile: {
    select: {
      documentType: true,
      documentNumber: true,
      firstName: true,
      paternalLastName: true,
      maternalLastName: true,
      phone: true,
      mobileCountry: true,
      mobile: true,
    },
  },
  grants: { select: { permissionId: true, functionalityName: true, enabled: true } },
} as const;

export interface UserDirectoryQuery {
  readonly search?: string;
  readonly role?: FixedRole;
  readonly status?: (typeof STATUSES)[number]['code'];
  readonly siteId?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: 'document' | 'firstName' | 'paternalLastName' | 'maternalLastName' | 'type';
  readonly direction?: 'asc' | 'desc';
}

const selection = {
  id: true,
  profile: { select: { documentNumber: true, firstName: true, paternalLastName: true, maternalLastName: true } },
  roles: { select: { role: true } },
} as const;

@Injectable()
export class UserDirectoryService {
  constructor(
    private readonly prisma: AuthPrismaService,
    @Optional() private readonly audit: AuditLogService | null = null,
  ) {}

  async list(query: UserDirectoryQuery) {
    const where = this.where(query);
    const direction = query.direction === 'desc' ? 'desc' as const : 'asc' as const;
    const skip = (query.page - 1) * query.pageSize;
    if (query.sort === 'type') return this.listByType(where, query, direction, skip);
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: this.order(query.sort, direction),
        skip,
        take: query.pageSize,
        select: selection,
      }),
    ]);
    return this.page(query, total, users);
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: detailSelection });
    if (!user) throw new NotFoundException();
    return presentDetail(user);
  }

  async create(dto: Parameters<typeof normalizeUserAccount>[0], actorId?: string) {
    const draft = this.normalize(dto, true);
    const resolved = await this.resolveGrants(draft.grants);
    const passwordHash = await argon2.hash(draft.password ?? '', { type: argon2.argon2id });
    try {
      const created = await this.prisma.$transaction(async (tx) => tx.user.create({
        data: {
          username: draft.documentNumber.toLowerCase(),
          email: draft.email,
          passwordHash,
          status: draft.enabled ? 'ACTIVE' : 'SUSPENDED',
          siteId: draft.siteId,
          profile: { create: this.profileData(draft) },
          roles: { create: resolved.roles.map((role) => ({ role })) },
          grants: { create: resolved.grants },
        },
        select: detailSelection,
      }));
      const detail = presentDetail(created);
      await this.note(actorId, `Creó la cuenta de ${personName(detail.firstName, detail.paternalLastName)}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async update(id: string, dto: Parameters<typeof normalizeUserAccount>[0], actorId: string) {
    const draft = this.normalize(dto, false);
    const resolved = await this.resolveGrants(draft.grants);
    if (actorId === id && (!draft.enabled || !resolved.roles.includes(UserRoleName.ADMINISTRATOR))) {
      throw new BadRequestException('No puedes quitar tu propio acceso de administrador.');
    }
    const passwordHash = draft.password ? await argon2.hash(draft.password, { type: argon2.argon2id }) : null;
    try {
      const detail = await this.prisma.$transaction(async (tx) => {
        const current = await tx.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
        if (!current) throw new NotFoundException();
        const updated = await tx.user.update({
          where: { id },
          data: {
            email: draft.email,
            status: draft.enabled ? 'ACTIVE' : 'SUSPENDED',
            siteId: draft.siteId,
            ...(passwordHash ? { passwordHash, passwordChangedAt: new Date() } : {}),
            profile: { upsert: { create: this.profileData(draft), update: this.profileData(draft) } },
            roles: { deleteMany: {}, create: resolved.roles.map((role) => ({ role })) },
            grants: { deleteMany: {}, create: resolved.grants },
          },
          select: detailSelection,
        });
        if (passwordHash || !draft.enabled) {
          await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        return presentDetail(updated);
      });
      await this.note(actorId, `Modificó la cuenta de ${personName(detail.firstName, detail.paternalLastName)}.`);
      return detail;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async resetPassword(id: string, actorId?: string): Promise<{ username: string; password: string }> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, username: true } });
    if (!user) throw new NotFoundException();
    const password = temporaryPassword();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.note(actorId, `Restableció la contraseña de ${user.username}.`);
    return { username: user.username, password };
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (actorId === id) throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { profile: { select: { firstName: true, paternalLastName: true } } },
    });
    const result = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
    });
    if (!result.count) throw new NotFoundException();
    await this.prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.note(actorId, `Eliminó la cuenta de ${personName(current?.profile?.firstName ?? '', current?.profile?.paternalLastName ?? '')}.`);
  }

  async requirePasswordChange(id: string, mustChangePassword: boolean, actorId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { username: true } });
    if (!user) throw new NotFoundException();
    const result = await this.prisma.user.updateMany({ where: { id, deletedAt: null }, data: { mustChangePassword } });
    if (!result.count) throw new NotFoundException();
    await this.note(actorId, mustChangePassword
      ? `Marcó el cambio de contraseña al iniciar sesión de ${user.username}.`
      : `Quitó el cambio de contraseña al iniciar sesión de ${user.username}.`);
  }

  private async note(actorId: string | undefined, action: string): Promise<void> {
    if (actorId) await this.audit?.recordFor(actorId, 'Usuarios', action);
  }

  private async listByType(where: ReturnType<UserDirectoryService['where']>, query: UserDirectoryQuery, direction: 'asc' | 'desc', skip: number) {
    const matched = await this.prisma.user.findMany({ where, select: { id: true, roles: { select: { role: true } } } });
    const ids = this.orderByType(matched, direction).slice(skip, skip + query.pageSize).map((user) => user.id);
    const users = ids.length === 0 ? [] : await this.prisma.user.findMany({ where: { id: { in: ids } }, select: selection });
    const byId = new Map(users.map((user) => [user.id, user]));
    return this.page(query, matched.length, ids.flatMap((id) => {
      const user = byId.get(id);
      return user ? [user] : [];
    }));
  }

  private page(query: UserDirectoryQuery, total: number, users: readonly {
    id: string;
    profile: { documentNumber: string; firstName: string; paternalLastName: string; maternalLastName: string | null } | null;
    roles: readonly { role: string }[];
  }[]) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      types: FIXED_ROLES.map((role) => ({ code: role.code, name: role.name })),
      statuses: STATUSES.map((status) => ({ code: status.code, name: status.name })),
      users: users.map((user) => present(user)),
    };
  }

  private where(query: UserDirectoryQuery) {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.role ? { roles: { some: { role: query.role } } } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { profile: { is: { documentNumber: { contains: search, mode: 'insensitive' as const } } } },
              { profile: { is: { firstName: { contains: search, mode: 'insensitive' as const } } } },
              { profile: { is: { paternalLastName: { contains: search, mode: 'insensitive' as const } } } },
              { profile: { is: { maternalLastName: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
  }

  private order(sort: UserDirectoryQuery['sort'], direction: 'asc' | 'desc') {
    const id = { id: 'asc' as const };
    switch (sort) {
      case 'document':
        return [{ profile: { documentNumber: direction } }, id];
      case 'firstName':
        return [{ profile: { firstName: direction } }, id];
      case 'maternalLastName':
        return [{ profile: { maternalLastName: direction } }, id];
      case 'type':
        return [id];
      case 'paternalLastName':
      default:
        return [{ profile: { paternalLastName: direction } }, { profile: { firstName: 'asc' as const } }, id];
    }
  }

  private orderByType<T extends { roles: readonly { role: string }[] }>(users: readonly T[], direction: 'asc' | 'desc'): T[] {
    return [...users].sort((left, right) => {
      const compared = this.typeRank(left.roles) - this.typeRank(right.roles);
      return direction === 'desc' ? -compared : compared;
    });
  }

  private typeRank(roles: readonly { role: string }[]): number {
    return roles.reduce((rank, item) => Math.min(rank, ROLE_ORDER.get(item.role) ?? ROLE_ORDER.size), ROLE_ORDER.size);
  }

  private normalize(input: Parameters<typeof normalizeUserAccount>[0], requirePassword: boolean): NormalizedUserAccount {
    try {
      return normalizeUserAccount(input, requirePassword);
    } catch (error) {
      if (error instanceof UserAccountRuleError) throw new BadRequestException(accountMessage(error.rule));
      throw error;
    }
  }

  private async resolveGrants(grants: readonly NormalizedUserAccount['grants'][number][]) {
    const rows = await this.prisma.permissionFunctionality.findMany({
      where: { permission: { deletedAt: null } },
      select: { name: true, permissionId: true, permission: { select: { moduleCode: true } } },
    });
    const known = new Map(rows.map((row) => [`${row.permissionId}:${row.name.toLocaleLowerCase('es')}`, row]));
    const selected = [];
    const modules = new Set<string>();
    for (const item of grants.filter((grant) => grant.enabled)) {
      const row = known.get(`${item.permissionId}:${item.name.toLocaleLowerCase('es')}`);
      if (!row) throw new BadRequestException('No se pudo guardar el usuario.');
      selected.push({ permissionId: row.permissionId, functionalityName: row.name, enabled: true });
      modules.add(row.permission.moduleCode);
    }
    const roles = [...modules].flatMap((code) => {
      const role = MODULE_ROLE[code];
      return role ? [role] : [];
    });
    if (roles.length === 0) throw new BadRequestException('Activa al menos una funcionalidad.');
    return { grants: selected, roles };
  }

  private profileData(draft: NormalizedUserAccount) {
    return {
      documentType: draft.documentType,
      documentNumber: draft.documentNumber,
      firstName: draft.firstName,
      paternalLastName: draft.paternalLastName,
      maternalLastName: draft.maternalLastName,
      phone: draft.phone,
      mobileCountry: draft.mobileCountry,
      mobile: draft.mobile,
    };
  }

  private rethrowPersistence(error: unknown): never {
    if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const target = 'meta' in error && typeof error.meta === 'object' && error.meta !== null && 'target' in error.meta ? String(error.meta.target) : '';
      if (target.includes('email')) throw new ConflictException('Ese correo ya está registrado.');
      if (target.includes('document') || target.includes('username')) throw new ConflictException('Ese documento ya está registrado.');
      throw new ConflictException('Ese usuario ya está registrado.');
    }
    throw error;
  }
}

const accountMessage = (rule: UserAccountRuleError['rule']): string => {
  switch (rule) {
    case 'name': return 'Revisa los nombres.';
    case 'document': return 'Revisa el documento.';
    case 'contact': return 'Revisa el correo o el teléfono.';
    case 'password': return 'La contraseña debe tener al menos 8 caracteres.';
    case 'site': return 'Selecciona una sede.';
    default: return 'Activa al menos una funcionalidad.';
  }
};

const presentDetail = (user: {
  id: string;
  email: string;
  status: string;
  siteId: string | null;
  profile: {
    documentType: string;
    documentNumber: string;
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
    phone: string | null;
    mobileCountry: string | null;
    mobile: string | null;
  } | null;
  grants: readonly { permissionId: string; functionalityName: string; enabled: boolean }[];
}) => ({
  id: user.id,
  documentType: user.profile?.documentType ?? 'DNI',
  documentNumber: user.profile?.documentNumber ?? '',
  firstName: user.profile?.firstName ?? '',
  paternalLastName: user.profile?.paternalLastName ?? '',
  maternalLastName: user.profile?.maternalLastName ?? '',
  siteId: user.siteId ?? '',
  phone: user.profile?.phone ?? '',
  mobileCountry: user.profile?.mobileCountry ?? '+51',
  mobile: user.profile?.mobile ?? '',
  email: user.email,
  enabled: user.status === 'ACTIVE',
  grants: user.grants.map((grant) => ({ permissionId: grant.permissionId, name: grant.functionalityName, enabled: grant.enabled })),
});

const present = (user: {
  id: string;
  profile: { documentNumber: string; firstName: string; paternalLastName: string; maternalLastName: string | null } | null;
  roles: readonly { role: string }[];
}) => {
  const roles = [...user.roles].sort((left, right) => (ROLE_ORDER.get(left.role) ?? 0) - (ROLE_ORDER.get(right.role) ?? 0));
  return {
    id: user.id,
    documentNumber: user.profile?.documentNumber ?? '',
    firstName: user.profile?.firstName ?? '',
    paternalLastName: user.profile?.paternalLastName ?? '',
    maternalLastName: user.profile?.maternalLastName ?? '',
    typeName: roles.map((item) => ROLE_NAMES.get(item.role)).filter((name): name is string => Boolean(name)).join(' - '),
    roles: roles.map((item) => item.role),
  };
};

const personName = (firstName: string, paternalLastName: string): string =>
  `${firstName} ${paternalLastName}`.replace(/\s+/g, ' ').trim() || 'un usuario';
