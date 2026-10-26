import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { resolveRedisEndpoint } from '../../../../../libs/common/src/redis-endpoint.js';

@Injectable()
export class NonceStore implements OnModuleDestroy {
  private readonly logger = new Logger(NonceStore.name);
  private readonly redis = this.connect();
  private readonly seen = new Map<string, number>();

  async claim(nonce: string, ttlSeconds: number): Promise<boolean> {
    if (this.redis) {
      const created = await this.redis.set(`notification:nonce:${nonce}`, '1', 'EX', ttlSeconds, 'NX');
      return created === 'OK';
    }
    const now = Date.now();
    for (const [key, expires] of this.seen) {
      if (expires <= now) this.seen.delete(key);
    }
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now + ttlSeconds * 1000);
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  private connect(): Redis | undefined {
    const endpoint = resolveRedisEndpoint(process.env);
    if (!endpoint) return undefined;
    const redis = new Redis({ host: endpoint.host, port: endpoint.port, password: endpoint.password, maxRetriesPerRequest: 2 });
    redis.on('error', (error: Error) => this.logger.warn(`Redis de nonces: ${error.message}`));
    return redis;
  }
}
