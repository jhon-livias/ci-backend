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
              mustChangePassword: false,
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
    }
    console.info('Cuentas de Tickets listas: administrador, jefe-area, asistente, solicitante.');
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudieron crear las cuentas de Tickets.');
  process.exitCode = 1;
});
