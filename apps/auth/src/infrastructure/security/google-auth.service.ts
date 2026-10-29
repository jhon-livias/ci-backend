import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

import { INSTITUTIONAL_EMAIL_DOMAIN, normalizeInstitutionalEmail } from '../../domain/institutional-email.js';

const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
const requestTimeoutMs = 5_000;

export const googleAuthConfigured = (): boolean =>
  googleClientId().length > 0 && googleClientSecret().length > 0 && googleRedirectUri().length > 0;

export const ticketsGoogleRedirectUri = (): string => process.env.TICKETS_GOOGLE_REDIRECT_URI?.trim() ?? '';

export const googleAuthorizationUrl = (state: string, redirectUri = googleRedirectUri()): string => {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('client_id', googleClientId());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('hd', INSTITUTIONAL_EMAIL_DOMAIN);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
};

export const googleStatesMatch = (expected: string, received: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length < 32 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

/** Correo institucional verificado por Google, o null si la identidad no se acepta. */
export const googleAccountEmail = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record['email_verified'] !== true || typeof record['email'] !== 'string') return null;
  if (typeof record['hd'] === 'string' && record['hd'].toLowerCase() !== INSTITUTIONAL_EMAIL_DOMAIN) {
    return null;
  }
  return normalizeInstitutionalEmail(record['email']);
};

const googleClientId = (): string => process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
const googleClientSecret = (): string => process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
const googleRedirectUri = (): string => process.env.GOOGLE_REDIRECT_URI?.trim() ?? '';

@Injectable()
export class GoogleAuthService {
  async accountEmail(code: string, redirectUri = googleRedirectUri()): Promise<string | null> {
    const accessToken = await this.accessToken(code, redirectUri);
    if (!accessToken) return null;
    const response = await fetch(userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) return null;
    return googleAccountEmail(await response.json());
  }

  private async accessToken(code: string, redirectUri: string): Promise<string | null> {
    const body = new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null) return null;
    const token = (payload as { access_token?: unknown }).access_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }
}
