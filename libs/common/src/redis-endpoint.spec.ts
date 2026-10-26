import { describe, expect, it } from 'vitest';
import { resolveRedisEndpoint } from './redis-endpoint.js';

describe('resolveRedisEndpoint', () => {
  it('requires redis in production', () => {
    expect(() => resolveRedisEndpoint({ NODE_ENV: 'production' })).toThrow(/REDIS_HOST/);
  });

  it('allows memory limits outside production when redis is unset', () => {
    expect(resolveRedisEndpoint({ NODE_ENV: 'development' })).toBeUndefined();
  });

  it('rejects a partial configuration', () => {
    expect(() => resolveRedisEndpoint({ REDIS_HOST: 'redis' })).toThrow(/juntos/);
  });

  it('returns a parsed endpoint', () => {
    expect(resolveRedisEndpoint({ REDIS_HOST: 'redis', REDIS_PASSWORD: 'a-long-password', REDIS_PORT: '6380' })).toEqual({
      host: 'redis',
      port: 6380,
      password: 'a-long-password',
    });
  });
});
