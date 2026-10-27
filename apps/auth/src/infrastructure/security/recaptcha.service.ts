import { Injectable, UnauthorizedException } from '@nestjs/common';

const verificationEndpoint = 'https://www.google.com/recaptcha/api/siteverify';
const verificationTimeoutMs = 5_000;

interface RecaptchaVerificationResponse {
  readonly success?: unknown;
  readonly score?: unknown;
  readonly action?: unknown;
  readonly hostname?: unknown;
}

const isVerificationResponse = (
  value: unknown,
): value is RecaptchaVerificationResponse =>
  typeof value === 'object' && value !== null;

const invalidChallenge = (): UnauthorizedException =>
  new UnauthorizedException(
    'No se pudo validar la solicitud. Inténtalo nuevamente.',
  );

const readMinimumScore = (value: string | undefined): number => {
  if (!value) return 0.5;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error('RECAPTCHA_MIN_SCORE debe ser un número entre 0 y 1.');
  }
  return score;
};

const readHostnames = (value: string | undefined): readonly string[] =>
  (value ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

@Injectable()
export class RecaptchaService {
  private readonly secret = process.env.RECAPTCHA_SECRET_KEY?.trim() ?? '';
  private readonly minimumScore = readMinimumScore(
    process.env.RECAPTCHA_MIN_SCORE,
  );
  private readonly allowedHostnames = readHostnames(
    process.env.RECAPTCHA_ALLOWED_HOSTNAMES,
  );
  private readonly enabled = process.env.RECAPTCHA_ENABLED !== 'false';

  constructor() {
    if (process.env.NODE_ENV === 'production' && !this.enabled) {
      throw new Error('reCAPTCHA no puede deshabilitarse en producción.');
    }
    if (this.enabled && process.env.NODE_ENV === 'production' && !this.secret) {
      throw new Error('RECAPTCHA_SECRET_KEY es obligatorio en producción.');
    }
    if (
      this.enabled &&
      process.env.NODE_ENV === 'production' &&
      this.allowedHostnames.length === 0
    ) {
      throw new Error(
        'RECAPTCHA_ALLOWED_HOSTNAMES es obligatorio en producción.',
      );
    }
  }

  async verifyLogin(token: string, remoteIp?: string): Promise<void> {
    // El modo explícitamente deshabilitado solo se permite fuera de producción,
    // para no requerir llamadas a Google durante pruebas locales automatizadas.
    if (!this.enabled) return;
    if (!this.secret) throw invalidChallenge();

    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    let response: Response;
    try {
      response = await fetch(verificationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(verificationTimeoutMs),
      });
    } catch {
      throw invalidChallenge();
    }

    if (!response.ok) throw invalidChallenge();

    let payload: RecaptchaVerificationResponse;
    try {
      const data: unknown = await response.json();
      if (!isVerificationResponse(data))
        throw new Error('Respuesta de reCAPTCHA inválida.');
      payload = data;
    } catch {
      throw invalidChallenge();
    }

    const hostname =
      typeof payload.hostname === 'string'
        ? payload.hostname.toLowerCase()
        : '';
    const hostnameAllowed =
      this.allowedHostnames.length === 0 ||
      this.allowedHostnames.includes(hostname);
    if (
      payload.success !== true ||
      payload.action !== 'login' ||
      typeof payload.score !== 'number' ||
      payload.score < this.minimumScore ||
      !hostnameAllowed
    ) {
      throw invalidChallenge();
    }
  }
}
