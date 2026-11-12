import { BadRequestException, ForbiddenException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';

import { UserRoleName, UserStatus } from '../infrastructure/persistence/generated/client.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import type { LoginDto } from '../interfaces/http/dto/login.dto.js';
import { loginIdentifier, normalizeInstitutionalEmail } from '../domain/institutional-email.js';
import { AuditLogService } from './audit-log.service.js';
import { NotificationService } from './notification.service.js';
import { SessionControl } from './session-control.js';
import { TotpService } from './totp.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
  readonly user: AuthenticatedUser;
}

export type LoginResult =
  | ({ readonly status: 'session' } & AuthenticatedSession)
  | { readonly status: 'enroll'; readonly enrollmentToken: string };

export interface AuthenticatedUser {
  readonly id: string;
  readonly username: string;
  readonly roles: readonly UserRoleName[];
  readonly applicationRoles: readonly string[];
  readonly scopes: readonly string[];
  readonly mustChangePassword: boolean;
  readonly sessionVersion: number;
  readonly profile: { readonly firstName: string; readonly paternalLastName: string; readonly documentNumber: string } | null;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationService,
    private readonly sessions: SessionControl,
    @Optional() @Inject(AuditLogService) private readonly audit: AuditLogService | null = null,
    @Optional() @Inject(TotpService) private readonly totp: TotpService | null = null,
  ) {}

  async login(input: LoginDto, userAgent?: string | string[]): Promise<LoginResult> {
    const identifier = loginIdentifier(input.username);
    if (!identifier) throw new UnauthorizedException('Credenciales inválidas.');
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: identifier }, { email: identifier }],
      },
      include: { profile: true, roles: true, careerScopes: true, applicationRoles: { include: { applicationRole: true } } },
    });

    if (!user || user.status !== UserStatus.ACTIVE || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (user.totpRequired && !user.totpEnabled) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      return { status: 'enroll', enrollmentToken: await this.enrollmentToken(user.id, user.username) };
    }
    if (user.totpEnabled) {
      if (!input.totpCode) throw new UnauthorizedException('Ingresa el código de tu aplicación de autenticación.');
      if (!this.totp?.matches(user.totpSecret, input.totpCode)) {
        await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
        throw new UnauthorizedException('El código de autenticación no es válido.');
      }
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
    await this.audit?.recordFor(user.id, 'Sesión', 'Inició sesión.');
    return { status: 'session', ...(await this.issueTokens(authenticatedUser, session.refreshToken, session.sessionId)) };
  }

  async loginWithGoogle(email: string, userAgent?: string | string[]): Promise<AuthenticatedSession> {
    const normalized = normalizeInstitutionalEmail(email);
    if (!normalized) throw new UnauthorizedException('Credenciales inválidas.');
    const user = await this.prisma.user.findFirst({
      where: { deletedAt: null, email: { equals: normalized, mode: 'insensitive' } },
      include: { profile: true, roles: true, careerScopes: true, applicationRoles: { include: { applicationRole: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (user.totpRequired && !user.totpEnabled) throw new ForbiddenException('Debes activar la autenticación de dos pasos. Ingresa con tu usuario y contraseña.');
    if (user.totpEnabled) throw new ForbiddenException('Esta cuenta usa autenticación de dos pasos. Ingresa con tu contraseña y el código de la aplicación.');

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
    await this.audit?.recordFor(user.id, 'Sesión', 'Inició sesión con Google.');
    return this.issueTokens(this.toAuthenticatedUser(user), session.refreshToken, session.sessionId);
  }

  async restore(accessToken: string): Promise<{ user: AuthenticatedUser; csrfToken: string; sessionId: string }> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub || !payload.csrf || !Array.isArray(payload.roles)) throw new UnauthorizedException();
    if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true, roles: true, careerScopes: true, applicationRoles: { include: { applicationRole: true } } },
    });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE || user.sessionVersion !== payload.sv) {
      throw new UnauthorizedException();
    }
    const accessSession = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: { userId: true, revokedAt: true },
    });
    if (!accessSession || accessSession.userId !== user.id || accessSession.revokedAt) throw new UnauthorizedException();
    return { user: this.toAuthenticatedUser(user), csrfToken: payload.csrf, sessionId: payload.sid };
  }

  async refresh(refreshToken: string, userAgent?: string | string[]): Promise<AuthenticatedSession> {
    const sessionId = refreshToken.split('.', 1)[0];
    if (!sessionId) throw new UnauthorizedException();
    const existing = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { profile: true, roles: true, careerScopes: true, applicationRoles: { include: { applicationRole: true } } } } },
    });
    if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) throw new UnauthorizedException();
    if (!(await argon2.verify(existing.refreshTokenHash, refreshToken))) throw new UnauthorizedException();
    if (existing.user.deletedAt || existing.user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    const replacement = await this.createSession(existing.userId, requestUserAgent(userAgent));
    await this.sessions.cutOne(existing.id);
    await this.prisma.authSession.delete({ where: { id: existing.id } });
    return this.issueTokens(this.toAuthenticatedUser(existing.user), replacement.refreshToken, replacement.sessionId);
  }

  async readEnrollment(token: string): Promise<{ id: string; username: string }> {
    let payload: { sub?: string; purpose?: string; username?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('La activación expiró. Vuelve a ingresar tu contraseña.');
    }
    if (payload.purpose !== 'totp-enroll' || !payload.sub) throw new UnauthorizedException('La activación expiró. Vuelve a ingresar tu contraseña.');
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: UserStatus.ACTIVE, totpRequired: true, totpEnabled: false },
      select: { id: true, username: true },
    });
    if (!user) throw new UnauthorizedException('La activación expiró. Vuelve a ingresar tu contraseña.');
    return user;
  }

  async completeEnrollment(userId: string, userAgent?: string | string[]): Promise<AuthenticatedSession> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE, totpEnabled: true },
      include: { profile: true, roles: true, careerScopes: true, applicationRoles: { include: { applicationRole: true } } },
    });
    if (!user) throw new UnauthorizedException('La activación expiró. Vuelve a ingresar tu contraseña.');
    const session = await this.createSession(user.id, requestUserAgent(userAgent));
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit?.recordFor(user.id, 'Sesión', 'Activó la autenticación de dos pasos e inició sesión.');
    return this.issueTokens(this.toAuthenticatedUser(user), session.refreshToken, session.sessionId);
  }

  async replacePassword(userId: string, password: string): Promise<void> {
    if (!/^[^<>]{8,72}$/u.test(password)) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.audit?.recordFor(userId, 'Sesión', 'Cambió su contraseña.');
    await this.sessions.cutAll(userId);
  }

  async logout(accessToken: string | undefined, refreshToken: string | undefined, csrfToken: string | undefined): Promise<void> {
    if (accessToken) {
      const restored = await this.restore(accessToken);
      if (!csrfToken || csrfToken !== restored.csrfToken) throw new UnauthorizedException();
      await this.audit?.recordFor(restored.user.id, 'Sesión', 'Cerró sesión.');
      await this.sessions.cutOne(restored.sessionId);
      return;
    }
    const sessionId = refreshToken?.split('.', 1)[0];
    if (sessionId) await this.sessions.cutOne(sessionId);
  }

  private async createSession(userId: string, userAgent?: string): Promise<{ refreshToken: string; sessionId: string }> {
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
    return { refreshToken, sessionId: session.id };
  }

  private async enrollmentToken(userId: string, username: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, purpose: 'totp-enroll', username }, { expiresIn: '10m' });
  }

  private async issueTokens(user: AuthenticatedUser, refreshToken: string, sessionId: string): Promise<AuthenticatedSession> {
    await this.sessions.publish(user.id, user.sessionVersion);
    const csrfToken = randomBytes(32).toString('base64url');
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      displayName: user.profile
        ? `${user.profile.firstName} ${user.profile.paternalLastName}`.trim()
        : user.username,
      documentNumber: user.profile?.documentNumber ?? '',
      roles: user.roles,
      applicationRoles: user.applicationRoles,
      scopes: user.scopes,
      sid: sessionId,
      sv: user.sessionVersion,
      csrf: csrfToken,
    });
    return { accessToken, refreshToken, csrfToken, user };
  }

  private toAuthenticatedUser(user: {
    id: string;
    username: string;
    mustChangePassword: boolean;
    sessionVersion: number;
    roles: readonly { role: UserRoleName }[];
    applicationRoles?: readonly { applicationRole: { code: string; enabled: boolean } }[];
    careerScopes?: readonly { careerCode: string }[];
    profile: { firstName: string; paternalLastName: string; documentNumber?: string | null } | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      roles: user.roles.map(({ role }) => role),
      applicationRoles: (user.applicationRoles ?? [])
        .filter(({ applicationRole }) => applicationRole.enabled)
        .map(({ applicationRole }) => applicationRole.code),
      scopes: (user.careerScopes ?? []).map((scope) => scope.careerCode),
      mustChangePassword: user.mustChangePassword,
      sessionVersion: user.sessionVersion,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            paternalLastName: user.profile.paternalLastName,
            documentNumber: user.profile.documentNumber ?? '',
          }
        : null,
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
  readonly sid?: unknown;
  readonly sv?: unknown;
}

const requestUserAgent = (userAgent: string | string[] | undefined): string | undefined => {
  const value = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  return value?.trim() || undefined;
};
