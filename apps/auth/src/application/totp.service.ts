import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { generateTotpSecret, openTotpSecret, sealTotpSecret, totpKeyUri, verifyTotp } from '../domain/totp.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

@Injectable()
export class TotpService {
  constructor(
    private readonly prisma: AuthPrismaService,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
  ) {}

  async status(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { totpEnabled: true } });
    if (!user) throw new UnauthorizedException();
    return { enabled: user.totpEnabled };
  }

  async begin(userId: string, username: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { totpEnabled: true } });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) throw new BadRequestException('La autenticación de dos pasos ya está activa.');
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: sealTotpSecret(secret, this.key()), totpEnabled: false },
    });
    return { secret, otpauthUrl: totpKeyUri(secret, username) };
  }

  async confirm(userId: string, code: string): Promise<void> {
    const secret = await this.secretOf(userId, false);
    if (!verifyTotp(secret, code)) throw new BadRequestException('El código de autenticación no es válido.');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit?.recordFor(userId, 'Sesión', 'Activó la autenticación de dos pasos.');
  }

  async disable(userId: string, password: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { passwordHash: true, totpEnabled: true, totpSecret: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) throw new BadRequestException('La autenticación de dos pasos no está activa.');
    if (!(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('La contraseña no es válida.');
    if (!verifyTotp(openTotpSecret(user.totpSecret, this.key()), code)) throw new BadRequestException('El código de autenticación no es válido.');
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } });
    await this.audit?.recordFor(userId, 'Sesión', 'Desactivó la autenticación de dos pasos.');
  }

  matches(sealed: string | null, code: string | undefined): boolean {
    if (!sealed || !code) return false;
    try {
      return verifyTotp(openTotpSecret(sealed, this.key()), code);
    } catch {
      return false;
    }
  }

  private async secretOf(userId: string, enabled: boolean): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, totpEnabled: enabled },
      select: { totpSecret: true },
    });
    if (!user?.totpSecret) throw new BadRequestException('Primero genera el código de configuración.');
    try {
      return openTotpSecret(user.totpSecret, this.key());
    } catch {
      throw new BadRequestException('No se pudo leer la configuración de autenticación.');
    }
  }

  private key(): string {
    const value = process.env.AUTH_JWT_ACCESS_SECRET;
    if (!value || value.length < 32) throw new BadRequestException('No se pudo preparar la autenticación de dos pasos.');
    return value;
  }
};
