import { timingSafeEqual } from 'node:crypto';

import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';

import { TotpService } from '../../application/totp.service.js';
import { AuthPrismaService } from '../../infrastructure/persistence/auth-prisma.service.js';
import { TotpAssertionDto } from './dto/totp-assertion.dto.js';

@Controller('auth/internal/totp')
export class TotpAssertionController {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly totp: TotpService,
  ) {}

  @Post('verify')
  @HttpCode(204)
  async verify(@Headers('x-internal-secret') secret: string | undefined, @Body() body: TotpAssertionDto): Promise<void> {
    assertSharedSecret(secret);
    const user = await this.prisma.user.findFirst({
      where: { id: body.userId, deletedAt: null, status: 'ACTIVE' },
      select: { totpEnabled: true, totpSecret: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('Activa la autenticación de dos pasos antes de eliminar.');
    }
    if (!this.totp.matches(user.totpSecret, body.code)) {
      throw new UnauthorizedException('El código de autenticación no es válido.');
    }
  }
}

const assertSharedSecret = (supplied: string | undefined): void => {
  const expected = process.env.AUTH_JWT_ACCESS_SECRET?.trim() ?? '';
  const left = Buffer.from(expected);
  const right = Buffer.from(typeof supplied === 'string' ? supplied : '');
  if (left.length < 32 || left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new UnauthorizedException();
  }
};
