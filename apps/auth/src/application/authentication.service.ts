import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

import { UserRoleName, UserStatus } from '../infrastructure/persistence/generated/client.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import type { LoginDto } from '../interfaces/http/dto/login.dto.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly roles: readonly UserRoleName[];
    readonly profile: {
      readonly firstName: string;
      readonly paternalLastName: string;
    } | null;
  };
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginDto, userAgent?: string): Promise<AuthenticatedSession> {
    const identifier = input.username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: identifier }, { email: identifier }],
      },
      include: { profile: true, roles: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const roles = user.roles.map(({ role }) => role);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
      this.prisma.authSession.create({
        data: { userId: user.id, refreshTokenHash, userAgent: userAgent?.slice(0, 512), expiresAt },
      }),
    ]);

    const accessToken = await this.jwtService.signAsync({ sub: user.id, roles });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        roles,
        profile: user.profile
          ? { firstName: user.profile.firstName, paternalLastName: user.profile.paternalLastName }
          : null,
      },
    };
  }

  private async recordFailedAttempt(userId: string, failedLoginAttempts: number): Promise<void> {
    const attempts = failedLoginAttempts + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });
  }
}
