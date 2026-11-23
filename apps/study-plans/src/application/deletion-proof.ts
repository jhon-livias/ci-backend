import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class DeletionProof {
  async assert(userId: string, code: string | undefined): Promise<void> {
    const secret = process.env.AUTH_JWT_ACCESS_SECRET?.trim() ?? '';
    if (secret.length < 32) throw new ServiceUnavailableException('No se pudo comprobar el código de autenticación.');
    const base = (process.env.AUTH_INTERNAL_URL?.trim() || 'http://auth:3001').replace(/\/$/u, '');
    let response: Response;
    try {
      response = await fetch(`${base}/api/v1/auth/internal/totp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ userId, code: code ?? '' }),
      });
    } catch {
      throw new ServiceUnavailableException('No se pudo comprobar el código de autenticación.');
    }
    if (response.status === 204) return;
    throw new UnauthorizedException(await failureMessage(response));
  }
}

const failureMessage = async (response: Response): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object') {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
      if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    }
  } catch { /* sin cuerpo */ }
  return 'El código de autenticación no es válido.';
};
