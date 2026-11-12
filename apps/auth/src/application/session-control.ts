import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { resolveRedisEndpoint } from '../../../../libs/common/src/redis-endpoint.js';
import { ACCESS_TOKEN_TTL_SECONDS, revokedSessionKey, sessionVersionKey } from '../../../../libs/common/src/session-access.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';

@Injectable()
export class SessionControl {
  private readonly redis: Redis | null;

  constructor(private readonly prisma: AuthPrismaService) {
    const endpoint = resolveRedisEndpoint(process.env);
    this.redis = endpoint
      ? new Redis({
          host: endpoint.host,
          port: endpoint.port,
          password: endpoint.password,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        })
      : null;
  }

  async publish(userId: string, version: number): Promise<void> {
    await this.redis?.set(sessionVersionKey(userId), String(version));
  }

  async cutOne(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis?.set(revokedSessionKey(sessionId), '1', 'EX', ACCESS_TOKEN_TTL_SECONDS);
  }

  async cutAll(userId: string): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.publish(userId, user.sessionVersion);
  }
}
