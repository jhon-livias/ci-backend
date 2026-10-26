import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { signWebhook } from '../../domain/notification.js';
import type { NotificationPush } from './notification-hub.js';

@Injectable()
export class WebhookNotificationChannel {
  private readonly logger = new Logger(WebhookNotificationChannel.name);
  private failures = 0;
  private openUntil = 0;
  private readonly url = process.env.NOTIFICATION_WEBHOOK_URL?.trim() ?? '';
  private readonly secret = process.env.NOTIFICATION_WEBHOOK_SECRET ?? '';

  constructor() {
    if (this.url) this.enabled();
  }

  enabled(): boolean {
    if (!this.url) return false;
    if (this.secret.length < 32) throw new Error('NOTIFICATION_WEBHOOK_SECRET debe tener al menos 32 caracteres.');
    const parsed = new URL(this.url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('NOTIFICATION_WEBHOOK_URL debe ser http o https.');
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('NOTIFICATION_WEBHOOK_URL debe usar https en producción.');
    }
    return true;
  }

  async deliver(notification: NotificationPush & { readonly recipientUserId: string; readonly correlationId: string }): Promise<void> {
    if (!this.enabled()) return;
    if (Date.now() < this.openUntil) throw new Error('El webhook de notificaciones está en pausa tras fallos repetidos.');
    const body = JSON.stringify({
      id: notification.id,
      recipientUserId: notification.recipientUserId,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt,
      correlationId: notification.correlationId,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/vnd.ci.notification+json',
          'x-ci-timestamp': timestamp,
          'x-ci-nonce': nonce,
          'x-ci-signature': signWebhook(this.secret, timestamp, nonce, body),
          'x-correlation-id': notification.correlationId,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Webhook respondió ${response.status}.`);
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= 5) this.openUntil = Date.now() + 30_000;
      this.logger.warn(`No se pudo entregar el webhook ${notification.id}.`);
      throw error;
    }
  }
}
