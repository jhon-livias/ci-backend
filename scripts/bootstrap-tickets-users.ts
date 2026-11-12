import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../apps/auth/src/infrastructure/persistence/generated/client.js';

const TICKETS_APP = 'ci-tickets';
const DEMO_PASSWORD = process.env.TICKETS_DEMO_PASSWORD?.trim() ?? '12345678';

interface TicketsDemoUser {
  readonly username: string;
  readonly email: string;
  readonly documentNumber: string;
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly phone: string;
  readonly role: 'tickets.admin' | 'tickets.area_manager' | 'tickets.assistant' | 'tickets.requester';
}

const USERS: readonly TicketsDemoUser[] = [
  { username: 'administrador', email: 'administrador@uprit.edu.pe', documentNumber: '10000001', firstName: 'Administrador', paternalLastName: 'Tickets', phone: '900000001', role: 'tickets.admin' },
  { username: 'jefe-area', email: 'jefe-area@uprit.edu.pe', documentNumber: '10000002', firstName: 'Jefe', paternalLastName: 'Area', phone: '900000002', role: 'tickets.area_manager' },
  { username: 'asistente', email: 'asistente@uprit.edu.pe', documentNumber: '10000003', firstName: 'Asistente', paternalLastName: 'Tickets', phone: '900000003', role: 'tickets.assistant' },
  { username: 'solicitante', email: 'solicitante@uprit.edu.pe', documentNumber: '10000004', firstName: 'Solicitante', paternalLastName: 'Tickets', phone: '900000004', role: 'tickets.requester' },
];

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatoria.`);
  return value;
};

const main = async (): Promise<void> => {
  if (DEMO_PASSWORD.length < 8) throw new Error('TICKETS_DEMO_PASSWORD debe tener al menos 8 caracteres.');
  const prisma = new PrismaClient({ adapter: new PrismaPg(required('AUTH_DATABASE_URL'), { schema: 'auth' }) });
  try {
    const application = await prisma.identityApplication.upsert({
      where: { code: TICKETS_APP },
      update: { enabled: true, name: 'Sistema de Tickets' },
      create: { code: TICKETS_APP, name: 'Sistema de Tickets', enabled: true },
    });
    const roles = new Map<string, string>();
    for (const item of [
      { code: 'tickets.admin', name: 'Administrador' },
      { code: 'tickets.area_manager', name: 'Responsable de área' },
      { code: 'tickets.assistant', name: 'Asistente' },
      { code: 'tickets.requester', name: 'Solicitante' },
    ] as const) {
      const role = await prisma.applicationRole.upsert({
        where: { applicationId_code: { applicationId: application.id, code: item.code } },
        update: { name: item.name, enabled: true },
        create: { applicationId: application.id, code: item.code, name: item.name, enabled: true },
      });
      roles.set(item.code, role.id);
    }

    const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
    for (const account of USERS) {
      const roleId = roles.get(account.role);
      if (!roleId) throw new Error(`No está definido el rol ${account.role}.`);
      const existing = await prisma.user.findFirst({
        where: { OR: [{ username: account.username }, { email: account.email }, { profile: { documentNumber: account.documentNumber } }] },
        select: { id: true },
      });
      const userId = existing
        ? (await prisma.user.update({
            where: { id: existing.id },
            data: {
              username: account.username,
              email: account.email,
              passwordHash,
              status: 'ACTIVE',
              sessionVersion: { increment: 1 },
              mustChangePassword: false,
              totpRequired: account.role === 'tickets.admin' || account.role === 'tickets.area_manager',
              failedLoginAttempts: 0,
              lockedUntil: null,
              deletedAt: null,
              profile: {
                upsert: {
                  create: { documentNumber: account.documentNumber, firstName: account.firstName, paternalLastName: account.paternalLastName, phone: account.phone, mobile: account.phone, mobileCountry: '+51' },
                  update: { documentNumber: account.documentNumber, firstName: account.firstName, paternalLastName: account.paternalLastName, phone: account.phone, mobile: account.phone, mobileCountry: '+51' },
                },
              },
            },
            select: { id: true },
          })).id
        : (await prisma.user.create({
            data: {
              username: account.username,
              email: account.email,
              passwordHash,
              status: 'ACTIVE',
              mustChangePassword: false,
              totpRequired: account.role === 'tickets.admin' || account.role === 'tickets.area_manager',
              profile: {
                create: { documentNumber: account.documentNumber, firstName: account.firstName, paternalLastName: account.paternalLastName, phone: account.phone, mobile: account.phone, mobileCountry: '+51' },
              },
            },
            select: { id: true },
          })).id;
      await prisma.userApplicationRole.deleteMany({
        where: { userId, applicationRole: { applicationId: application.id } },
      });
      await prisma.userApplicationRole.create({ data: { userId, applicationRoleId: roleId } });
      if (account.username === 'administrador') await grantEverySystem(prisma, userId);
    }
    console.info('Cuentas de Tickets listas: administrador, jefe-area, asistente, solicitante.');
  } finally {
    await prisma.$disconnect();
  }
};

const grantEverySystem = async (prisma: PrismaClient, userId: string): Promise<void> => {
  await prisma.userRole.upsert({
    where: { userId_role: { userId, role: 'ADMINISTRATOR' } },
    update: {},
    create: { userId, role: 'ADMINISTRATOR' },
  });
  const plans = await prisma.identityApplication.findUnique({ where: { code: 'study-plans' }, select: { id: true } });
  if (plans) {
    const faculty = await prisma.applicationRole.findUnique({
      where: { applicationId_code: { applicationId: plans.id, code: 'study-plans.faculty' } },
      select: { id: true },
    });
    if (faculty) {
      await prisma.userApplicationRole.upsert({
        where: { userId_applicationRoleId: { userId, applicationRoleId: faculty.id } },
        update: {},
        create: { userId, applicationRoleId: faculty.id },
      });
    }
  }
  for (const careerCode of ['IC', 'AU']) {
    await prisma.userCareerScope.upsert({
      where: { userId_careerCode: { userId, careerCode } },
      update: {},
      create: { userId, careerCode },
    });
  }
  const functionalities = await prisma.permissionFunctionality.findMany({
    where: { enabled: true, permission: { enabled: true, deletedAt: null } },
    select: { permissionId: true, name: true },
  });
  for (const item of functionalities) {
    await prisma.userFunctionalityGrant.upsert({
      where: { userId_permissionId_functionalityName: { userId, permissionId: item.permissionId, functionalityName: item.name } },
      update: { enabled: true },
      create: { userId, permissionId: item.permissionId, functionalityName: item.name, enabled: true },
    });
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudieron crear las cuentas de Tickets.');
  process.exitCode = 1;
});
