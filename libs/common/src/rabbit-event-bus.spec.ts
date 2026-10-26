import { describe, expect, it } from 'vitest';
import { resolveRabbitEndpoint } from './rabbit-event-bus.js';

describe('resolveRabbitEndpoint', () => {
  it('stays optional when rabbit is not configured', () => {
    expect(resolveRabbitEndpoint({})).toBeUndefined();
  });

  it('rejects a partial configuration', () => {
    expect(() => resolveRabbitEndpoint({ RABBITMQ_HOST: 'rabbitmq' })).toThrow(/juntos/);
  });

  it('returns a parsed endpoint', () => {
    expect(resolveRabbitEndpoint({
      RABBITMQ_HOST: 'rabbitmq',
      RABBITMQ_USER: 'ci_app',
      RABBITMQ_PASSWORD: 'a-long-password',
      RABBITMQ_PORT: '5673',
    })).toEqual({ host: 'rabbitmq', port: 5673, user: 'ci_app', password: 'a-long-password' });
  });
});
