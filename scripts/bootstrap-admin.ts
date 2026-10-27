import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { INSTITUTIONAL_EMAIL_MESSAGE, normalizeInstitutionalEmail } from '../apps/auth/src/domain/institutional-email.js';
import { PrismaClient, UserRoleName, UserStatus } from '../apps/auth/src/infrastructure/persistence/generated/client.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} es obligatoria.`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const databaseUrl = required('AUTH_DATABASE_URL');
  const username = required('ADMIN_USERNAME').toLowerCase();
  const email = normalizeInstitutionalEmail(required('ADMIN_EMAIL'));
  if (!email) throw new Error(INSTITUTIONAL_EMAIL_MESSAGE);
  const password = required('ADMIN_PASSWORD');

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl, { schema: 'auth' }) });
  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Ya existe una cuenta con ADMIN_USERNAME o ADMIN_EMAIL. No se modificó ninguna cuenta.');
    }

    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            documentNumber: required('ADMIN_DOCUMENT_NUMBER'),
            firstName: required('ADMIN_FIRST_NAME'),
            paternalLastName: required('ADMIN_PATERNAL_LAST_NAME'),
            maternalLastName: process.env.ADMIN_MATERNAL_LAST_NAME?.trim() || null,
          },
        },
        roles: { create: { role: UserRoleName.ADMINISTRATOR } },
      },
    });
    console.info('La cuenta administradora fue creada correctamente.');
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta administradora.');
  process.exitCode = 1;
});
