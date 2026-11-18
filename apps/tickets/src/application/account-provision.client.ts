import { BadRequestException, Injectable } from '@nestjs/common';

export interface ProvisionedAccount {
  readonly userId: string;
  readonly created: boolean;
  readonly username: string;
}

@Injectable()
export class AccountProvisionClient {
  async provision(input: {
    readonly email: string;
    readonly documentNumber: string;
    readonly fullName: string;
    readonly phone?: string;
    readonly roles: readonly ('tickets.area_manager' | 'tickets.assistant' | 'tickets.requester')[];
  }): Promise<ProvisionedAccount> {
    const secret = process.env.TICKETS_AUTH_INTERNAL_SECRET?.trim() ?? '';
    if (secret.length < 32) throw new BadRequestException('No está configurada la creación de cuentas.');
    const base = (process.env.AUTH_INTERNAL_URL?.trim() || 'http://auth:3001').replace(/\/$/u, '');
    let response: Response;
    try {
      response = await fetch(`${base}/api/v1/auth/internal/tickets/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify(input),
      });
    } catch {
      throw new BadRequestException('No pudimos crear la cuenta. Inténtalo nuevamente.');
    }
    if (!response.ok) throw new BadRequestException(await failureMessage(response));
    const payload = await response.json() as Partial<ProvisionedAccount>;
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string' || typeof payload.created !== 'boolean') {
      throw new BadRequestException('No pudimos crear la cuenta. Inténtalo nuevamente.');
    }
    return { userId: payload.userId, created: payload.created, username: payload.username };
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
  } catch {
    /* cuerpo no JSON */
  }
  return 'No pudimos crear la cuenta. Inténtalo nuevamente.';
};
