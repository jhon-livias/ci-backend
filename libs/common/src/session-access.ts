import { Redis } from 'ioredis';

import { resolveRedisEndpoint } from './redis-endpoint.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export const sessionVersionKey = (userId: string): string => `ci:sv:${userId}`;

export const revokedSessionKey = (sessionId: string): string => `ci:revoked-sid:${sessionId}`;

/** Compara la cookie de acceso con la versión publicada por identidad. Sin Redis, en producción niega el acceso. */
export class SessionAccess {
  private constructor(private readonly redis: Redis | null) {}

  static open(env: NodeJS.ProcessEnv = process.env): SessionAccess {
    const endpoint = resolveRedisEndpoint(env);
    if (!endpoint) return new SessionAccess(null);
    return new SessionAccess(new Redis({
      host: endpoint.host,
      port: endpoint.port,
      password: endpoint.password,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    }));
  }

  async allows(userId: string, version: number, sessionId: string): Promise<boolean> {
    if (!this.redis) return process.env.NODE_ENV !== 'production';
    try {
      const [current, revoked] = await Promise.all([
        this.redis.get(sessionVersionKey(userId)),
        this.redis.get(revokedSessionKey(sessionId)),
      ]);
      if (revoked) return false;
      return current === String(version);
    } catch {
      return false;
    }
  }
}
