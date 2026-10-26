import { describe, expect, it } from 'vitest';
import { isNotificationRequestedV1 } from './notification-requested.v1.js';

const valid = {
  id: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  title: 'Sesión iniciada',
  body: 'Se inició una sesión en tu cuenta.',
  createdAt: '2026-10-26T18:00:00.000Z',
  correlationId: 'corr-12345678',
};

describe('notification.requested.v1', () => {
  it('accepts a complete event', () => {
    expect(isNotificationRequestedV1(valid)).toBe(true);
  });

  it('rejects html and incomplete payloads', () => {
    expect(isNotificationRequestedV1({ ...valid, title: '<script>' })).toBe(false);
    expect(isNotificationRequestedV1({ ...valid, recipientUserId: 'no-es-uuid' })).toBe(false);
    expect(isNotificationRequestedV1({ title: valid.title })).toBe(false);
  });
});
