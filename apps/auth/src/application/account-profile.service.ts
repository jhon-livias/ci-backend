import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { FIXED_ROLES, type FixedRole } from '../domain/access-policy.js';
import { AuditLogService } from './audit-log.service.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { MaritalStatus, ProfileGender } from '../infrastructure/persistence/generated/client.js';

const ROLE_NAMES = new Map(FIXED_ROLES.map((role) => [role.code, role.name]));
const ROLE_ORDER = new Map<FixedRole, number>(FIXED_ROLES.map((role, index) => [role.code, index]));
const STATUS_NAMES = new Map([
  ['ACTIVE', 'Habilitado'],
  ['INVITED', 'Invitado'],
  ['SUSPENDED', 'Deshabilitado'],
  ['LOCKED', 'Bloqueado'],
]);

export interface AccountProfileUpdate {
  readonly gender: 'MALE' | 'FEMALE' | 'OTHER';
  readonly birthDate: string;
  readonly maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED';
  readonly mobileCountry: string;
  readonly mobile: string;
  readonly personalEmail: string;
  readonly address: string;
}

export interface AccountProfileView {
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly maternalLastName: string;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly gender: string;
  readonly birthDate: string;
  readonly maritalStatus: string;
  readonly mobileCountry: string;
  readonly mobile: string;
  readonly personalEmail: string;
  readonly email: string;
  readonly address: string;
  readonly siteId: string;
  readonly typeName: string;
  readonly statusName: string;
  readonly username: string;
}

const GENDERS = new Set(['MALE', 'FEMALE', 'OTHER']);
const MARITAL = new Set(['SINGLE', 'MARRIED', 'DIVORCED']);
const COUNTRIES = new Set(['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34']);

export const normalizeAccountProfile = (input: AccountProfileUpdate): AccountProfileUpdate => {
  const birthDate = input.birthDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new BadRequestException('Revisa la fecha de nacimiento.');
  const [year, month, day] = birthDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1920 ||
    birthDate > today
  ) {
    throw new BadRequestException('Revisa la fecha de nacimiento.');
  }
  const personalEmail = input.personalEmail.trim().toLowerCase();
  if (!/^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/.test(personalEmail) || personalEmail.length > 254) {
    throw new BadRequestException('Revisa el correo personal.');
  }
  const address = input.address.trim().replace(/\s+/g, ' ');
  if (address.length < 5 || address.length > 240 || /[<>]/.test(address)) {
    throw new BadRequestException('Revisa la dirección.');
  }
  if (!GENDERS.has(input.gender) || !MARITAL.has(input.maritalStatus) || !COUNTRIES.has(input.mobileCountry) || !/^\d{6,15}$/.test(input.mobile)) {
    throw new BadRequestException('Revisa los datos del perfil.');
  }
  return {
    gender: input.gender,
    birthDate,
    maritalStatus: input.maritalStatus,
    mobileCountry: input.mobileCountry,
    mobile: input.mobile,
    personalEmail,
    address,
  };
};

@Injectable()
export class AccountProfileService {
  constructor(
    private readonly prisma: AuthPrismaService,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
  ) {}

  async get(userId: string): Promise<AccountProfileView> {
    const user = await this.find(userId);
    return this.present(user);
  }

  async update(userId: string, input: AccountProfileUpdate): Promise<AccountProfileView> {
    const draft = normalizeAccountProfile(input);
    const user = await this.find(userId);
    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        gender: draft.gender as ProfileGender,
        birthDate: new Date(`${draft.birthDate}T00:00:00.000Z`),
        maritalStatus: draft.maritalStatus as MaritalStatus,
        mobileCountry: draft.mobileCountry,
        mobile: draft.mobile,
        personalEmail: draft.personalEmail,
        address: draft.address,
      },
    });
    await this.audit?.recordFor(userId, 'Sesión', 'Actualizó su perfil.');
    return this.present({
      ...user,
      profile: {
        ...user.profile,
        gender: draft.gender,
        birthDate: new Date(`${draft.birthDate}T00:00:00.000Z`),
        maritalStatus: draft.maritalStatus,
        mobileCountry: draft.mobileCountry,
        mobile: draft.mobile,
        personalEmail: draft.personalEmail,
        address: draft.address,
      },
    });
  }

  private async find(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        email: true,
        username: true,
        status: true,
        siteId: true,
        roles: { select: { role: true } },
        profile: {
          select: {
            documentType: true,
            documentNumber: true,
            firstName: true,
            paternalLastName: true,
            maternalLastName: true,
            gender: true,
            birthDate: true,
            maritalStatus: true,
            mobileCountry: true,
            mobile: true,
            personalEmail: true,
            address: true,
          },
        },
      },
    });
    if (!user?.profile) throw new NotFoundException();
    return { ...user, profile: user.profile };
  }

  private present(user: {
    email: string;
    username: string;
    status: string;
    siteId: string | null;
    roles: readonly { role: string }[];
    profile: {
      documentType: string;
      documentNumber: string;
      firstName: string;
      paternalLastName: string;
      maternalLastName: string | null;
      gender: string | null;
      birthDate: Date | null;
      maritalStatus: string | null;
      mobileCountry: string | null;
      mobile: string | null;
      personalEmail: string | null;
      address: string | null;
    };
  }): AccountProfileView {
    const roles = [...user.roles].sort((left, right) => (ROLE_ORDER.get(left.role as FixedRole) ?? 0) - (ROLE_ORDER.get(right.role as FixedRole) ?? 0));
    return {
      firstName: user.profile.firstName,
      paternalLastName: user.profile.paternalLastName,
      maternalLastName: user.profile.maternalLastName ?? '',
      documentType: user.profile.documentType,
      documentNumber: user.profile.documentNumber,
      gender: user.profile.gender ?? '',
      birthDate: user.profile.birthDate ? user.profile.birthDate.toISOString().slice(0, 10) : '',
      maritalStatus: user.profile.maritalStatus ?? '',
      mobileCountry: user.profile.mobileCountry ?? '+51',
      mobile: user.profile.mobile ?? '',
      personalEmail: user.profile.personalEmail ?? '',
      email: user.email,
      address: user.profile.address ?? '',
      siteId: user.siteId ?? '',
      typeName: roles.map((role) => ROLE_NAMES.get(role.role as never)).filter((name): name is string => Boolean(name)).join(' - '),
      statusName: STATUS_NAMES.get(user.status) ?? '',
      username: user.username,
    };
  }
}
