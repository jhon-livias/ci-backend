import { createHmac, timingSafeEqual } from 'node:crypto';

export type NotificationTransport = 'websocket' | 'webhook';

const transports = new Set<NotificationTransport>(['websocket', 'webhook']);

export const parseNotificationTransports = (value: string | undefined): readonly NotificationTransport[] => {
  const requested = (value ?? 'websocket').split(',').map((item) => item.trim()).filter(Boolean);
  const selected = requested.filter((item): item is NotificationTransport => transports.has(item as NotificationTransport));
  if (selected.length === 0 || selected.length !== requested.length) {
    throw new Error('NOTIFICATION_TRANSPORTS debe ser websocket, webhook o ambos separados por coma.');
  }
  return [...new Set(selected)];
};

export const webhookCanonical = (timestamp: string, nonce: string, body: string): string =>
  `${timestamp}.${nonce}.${body}`;

export const signWebhook = (secret: string, timestamp: string, nonce: string, body: string): string =>
  createHmac('sha256', secret).update(webhookCanonical(timestamp, nonce, body)).digest('hex');

export const webhookSignaturesMatch = (expected: string, received: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const webhookTimestampFresh = (timestamp: string, nowMs: number, windowMs = 5 * 60 * 1000): boolean => {
  if (!/^\d{10,13}$/.test(timestamp)) return false;
  const millis = timestamp.length === 13 ? Number(timestamp) : Number(timestamp) * 1000;
  return Number.isFinite(millis) && Math.abs(nowMs - millis) <= windowMs;
};
