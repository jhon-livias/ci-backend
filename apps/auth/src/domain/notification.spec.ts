import { describe, expect, it } from 'vitest';
import { parseNotificationTransports, signWebhook, webhookSignaturesMatch, webhookTimestampFresh } from './notification.js';

describe('notification transports and webhook signature', () => {
  it('defaults to websocket and accepts both channels', () => {
    expect(parseNotificationTransports(undefined)).toEqual(['websocket']);
    expect(parseNotificationTransports('webhook,websocket')).toEqual(['webhook', 'websocket']);
  });

  it('rejects an unknown channel', () => {
    expect(() => parseNotificationTransports('email')).toThrow(/NOTIFICATION_TRANSPORTS/);
  });

  it('accepts the signature of the exact body and a fresh timestamp', () => {
    const signature = signWebhook('secret-with-32-characters-minimum', '1761500000', 'nonce-1', '{"id":"1"}');
    expect(webhookSignaturesMatch(signature, signature)).toBe(true);
    expect(webhookSignaturesMatch(signature, signWebhook('secret-with-32-characters-minimum', '1761500000', 'nonce-1', '{"id":"2"}'))).toBe(false);
    expect(webhookTimestampFresh('1761500000', 1761500000 * 1000)).toBe(true);
    expect(webhookTimestampFresh('1761500000', (1761500000 + 600) * 1000)).toBe(false);
  });
});
