import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { UserStatus } from '../infrastructure/persistence/generated/client.js';
import type { AuthenticatedUser } from './authentication.service.js';

const AUTHORIZATION_CODE_TTL_MS = 2 * 60 * 1000;
const TICKETS_CLIENT_ID = 'ci-tickets';

export interface SsoIdentity {
  readonly subject: string;
  readonly username: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly roles: readonly string[];
}

@Injectable()
export class SsoService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async authorize(input: {
    user: AuthenticatedUser;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
  }): Promise<string> {
    this.validateAuthorizeInput(input.clientId, input.redirectUri, input.codeChallenge);
    const application = await this.prisma.identityApplication.findUnique({
      where: { code: input.clientId },
      select: { id: true, enabled: true },
    });
    if (!application?.enabled) throw new BadRequestException('Aplicación SSO no habilitada.');

    const code = randomBytes(32).toString('base64url');
    await this.prisma.ssoAuthorizationCode.create({
      data: {
        codeHash: digest(code),
        userId: input.user.id,
        applicationId: application.id,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
      },
    });
    return code;
  }

  async exchange(input: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<SsoIdentity> {
    this.validateExchangeInput(input);
    const record = await this.prisma.ssoAuthorizationCode.findUnique({
      where: { codeHash: digest(input.code) },
      include: {
        application: { select: { code: true, enabled: true } },
        user: {
          include: {
            profile: true,
            applicationRoles: { include: { applicationRole: true } },
          },
        },
      },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.application.enabled ||
      record.user.deletedAt || record.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Código de autorización inválido o vencido.');
    }
    if (record.application.code !== input.clientId || record.redirectUri !== input.redirectUri) {
      throw new UnauthorizedException('El código no corresponde a esta aplicación.');
    }
    if (!safeEqual(record.codeChallenge, pkceChallenge(input.codeVerifier))) {
      throw new UnauthorizedException('La verificación PKCE no coincide.');
    }

    const claimed = await this.prisma.ssoAuthorizationCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException('Código de autorización ya utilizado.');

    const roles = record.user.applicationRoles
      .filter(({ applicationRole }) => applicationRole.enabled && applicationRole.applicationId === record.applicationId)
      .map(({ applicationRole }) => applicationRole.code);
    const profile = record.user.profile;
    return {
      subject: record.user.id,
      username: record.user.username,
      email: record.user.email,
      displayName: profile ? `${profile.firstName} ${profile.paternalLastName}`.trim() : null,
      roles,
    };
  }

  private validateAuthorizeInput(clientId: string, redirectUri: string, codeChallenge: string): void {
    if (clientId !== TICKETS_CLIENT_ID) throw new BadRequestException('Cliente SSO no reconocido.');
    if (redirectUri !== ticketsRedirectUri()) throw new BadRequestException('URI de retorno no autorizada.');
    if (!/^[A-Za-z0-9_-]{43,128}$/u.test(codeChallenge)) {
      throw new BadRequestException('code_challenge PKCE inválido.');
    }
  }

  private validateExchangeInput(input: { clientId: string; code: string; redirectUri: string; codeVerifier: string }): void {
    this.validateAuthorizeInput(input.clientId, input.redirectUri, pkceChallenge(input.codeVerifier));
    if (!/^[A-Za-z0-9_-]{32,128}$/u.test(input.code)) throw new BadRequestException('Código inválido.');
    if (!/^[A-Za-z0-9._~-]{43,128}$/u.test(input.codeVerifier)) {
      throw new BadRequestException('code_verifier PKCE inválido.');
    }
  }
}

const ticketsRedirectUri = (): string => {
  const configured = process.env.TICKETS_SSO_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new ServiceUnavailableException('El retorno SSO de Tickets no está configurado.');
  }
  return 'http://localhost:4201/auth/callback';
};
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');
const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
