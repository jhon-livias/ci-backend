import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';

import { normalizeInstitutionalEmail } from '../domain/institutional-email.js';
import { recoveryMail } from '../domain/smtp-mail.js';
import { UserStatus } from '../infrastructure/persistence/generated/client.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { SmtpMailChannel } from '../infrastructure/mail/smtp-mail.channel.js';
import { AuditLogService } from './audit-log.service.js';

const RECOVERY_TTL_MS = 15 * 60 * 1000;
const GENERIC_FAILURE = 'No pudimos restablecer la contraseña. Revisa el código e inténtalo nuevamente.';

const recoveryCode = (): string => randomInt(0, 100_000_000).toString().padStart(8, '0');

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly mail: SmtpMailChannel,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
  ) {}

  async request(email: string): Promise<void> {
    const normalized = normalizeInstitutionalEmail(email);
    if (!normalized || !this.mail.enabled) return;
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) {
      await argon2.hash(recoveryCode(), { type: argon2.argon2id });
      return;
    }
    const code = recoveryCode();
    const tokenHash = await argon2.hash(code, { type: argon2.argon2id });
    const created = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RECOVERY_TTL_MS) },
      select: { id: true },
    });
    try {
      const message = recoveryMail(code);
      await this.mail.send({ to: normalized, subject: message.subject, text: message.text });
    } catch (error) {
      await this.prisma.passwordResetToken.delete({ where: { id: created.id } }).catch(() => undefined);
      this.logger.error(`No se pudo enviar el correo de recuperación: ${error instanceof Error ? error.message : 'error'}`);
      return;
    }
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, id: { not: created.id } },
      data: { usedAt: new Date() },
    });
    await this.audit?.recordFor(user.id, 'Sesión', 'Solicitó restablecer la contraseña.');
  }

  async confirm(email: string, code: string, password: string): Promise<void> {
    if (!/^[^<>]{8,72}$/u.test(password)) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    const normalized = normalizeInstitutionalEmail(email);
    const user = normalized
      ? await this.prisma.user.findFirst({
        where: { email: normalized, deletedAt: null, status: UserStatus.ACTIVE },
        select: { id: true },
      })
      : null;
    const tokens = user
      ? await this.prisma.passwordResetToken.findMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, tokenHash: true },
      })
      : [];
    let matched = false;
    for (const token of tokens) {
      const valid = await argon2.verify(token.tokenHash, code).catch(() => false);
      if (!valid) continue;
      matched = true;
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.passwordResetToken.updateMany({ where: { userId: user!.id, usedAt: null }, data: { usedAt: now } }),
        this.prisma.user.update({
          where: { id: user!.id },
          data: {
            passwordHash,
            passwordChangedAt: now,
            mustChangePassword: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }),
        this.prisma.authSession.updateMany({ where: { userId: user!.id, revokedAt: null }, data: { revokedAt: now } }),
      ]);
      await this.audit?.recordFor(user!.id, 'Sesión', 'Restableció su contraseña con un código.');
      return;
    }
    if (!matched) throw new BadRequestException(GENERIC_FAILURE);
  }
}
