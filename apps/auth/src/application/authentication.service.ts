import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';

import { UserRoleName, UserStatus } from '../infrastructure/persistence/generated/client.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import type { LoginDto } from '../interfaces/http/dto/login.dto.js';
import { NotificationService } from './notification.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
  readonly user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly username: string;
  readonly roles: readonly UserRoleName[];
  readonly profile: { readonly firstName: string; readonly paternalLastName: string } | null;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationService,
  ) {}

  async login(input: LoginDto, userAgent?: string | string[]): Promise<AuthenticatedSession> {
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

    const authenticatedUser = this.toAuthenticatedUser(user);
    const session = await this.createSession(user.id, requestUserAgent(userAgent));

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const event = {
      id: randomUUID(),
      recipientUserId: user.id,
      title: 'Sesión iniciada',
      body: 'Se inició una sesión en tu cuenta.',
      createdAt: new Date().toISOString(),
      correlationId: randomUUID(),
    };
    void this.notifications.record(event).then(() => this.notifications.publish(event)).catch(() => undefined);
    return this.issueTokens(authenticatedUser, session.refreshToken);
  }

  async restore(accessToken: string): Promise<{ user: AuthenticatedUser; csrfToken: string }> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub || !payload.csrf || !Array.isArray(payload.roles)) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true, roles: true },
    });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    return { user: this.toAuthenticatedUser(user), csrfToken: payload.csrf };
  }

  async refresh(refreshToken: string, userAgent?: string | string[]): Promise<AuthenticatedSession> {
    const sessionId = refreshToken.split('.', 1)[0];
    if (!sessionId) throw new UnauthorizedException();
    const existing = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { profile: true, roles: true } } },
    });
    if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) throw new UnauthorizedException();
    if (!(await argon2.verify(existing.refreshTokenHash, refreshToken))) throw new UnauthorizedException();
    if (existing.user.deletedAt || existing.user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    const replacement = await this.createSession(existing.userId, requestUserAgent(userAgent));
    await this.prisma.authSession.delete({ where: { id: existing.id } });
    return this.issueTokens(this.toAuthenticatedUser(existing.user), replacement.refreshToken);
  }

  async logout(accessToken: string | undefined, refreshToken: string | undefined, csrfToken: string | undefined): Promise<void> {
    if (accessToken) {
      const restored = await this.restore(accessToken);
      if (!csrfToken || csrfToken !== restored.csrfToken) throw new UnauthorizedException();
    }
    const sessionId = refreshToken?.split('.', 1)[0];
    if (sessionId) await this.prisma.authSession.deleteMany({ where: { id: sessionId } });
  }

  private async createSession(userId: string, userAgent?: string): Promise<{ refreshToken: string }> {
    const secret = randomBytes(48).toString('base64url');
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: 'pending',
        userAgent: userAgent?.slice(0, 512),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
      select: { id: true },
    });
    const refreshToken = `${session.id}.${secret}`;
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: await argon2.hash(refreshToken, { type: argon2.argon2id }) },
    });
    return { refreshToken };
  }

  private async issueTokens(user: AuthenticatedUser, refreshToken: string): Promise<AuthenticatedSession> {
    const csrfToken = randomBytes(32).toString('base64url');
    const accessToken = await this.jwtService.signAsync({ sub: user.id, roles: user.roles, csrf: csrfToken });
    return { accessToken, refreshToken, csrfToken, user };
  }

  private toAuthenticatedUser(user: {
    id: string;
    username: string;
    roles: readonly { role: UserRoleName }[];
    profile: { firstName: string; paternalLastName: string } | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      roles: user.roles.map(({ role }) => role),
      profile: user.profile ? { firstName: user.profile.firstName, paternalLastName: user.profile.paternalLastName } : null,
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

interface AccessTokenPayload {
  readonly sub: string;
  readonly roles: readonly UserRoleName[];
  readonly csrf: string;
}

const requestUserAgent = (userAgent: string | string[] | undefined): string | undefined => {
  const value = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  return value?.trim() || undefined;
};
