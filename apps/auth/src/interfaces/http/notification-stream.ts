import websocket from '@fastify/websocket';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { isNotificationRequestedV1 } from '../../../../../libs/contracts/src/notification-requested.v1.js';
import { signWebhook, webhookSignaturesMatch, webhookTimestampFresh } from '../../domain/notification.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { NotificationService } from '../../application/notification.service.js';
import { NotificationHub, type NotificationSocket } from '../../infrastructure/notifications/notification-hub.js';
import { NonceStore } from '../../infrastructure/notifications/nonce-store.js';

const header = (request: FastifyRequest, name: string): string => {
  const value = request.headers[name];
  return typeof value === 'string' ? value : '';
};

export const registerNotificationTransports = async (app: NestFastifyApplication): Promise<void> => {
  const fastify = app.getHttpAdapter().getInstance();
  const hub = app.get(NotificationHub);
  const authentication = app.get(AuthenticationService);
  const notifications = app.get(NotificationService);
  const nonces = app.get(NonceStore);
  const secret = process.env.NOTIFICATION_WEBHOOK_SECRET ?? '';

  await app.register(websocket);
  fastify.addContentTypeParser('application/vnd.ci.notification+json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  fastify.get('/api/v1/auth/notifications/events', async (request, reply) => {
    const token = request.cookies?.['ci_access'];
    if (!token) return reply.code(401).send();
    const session = await authentication.restore(token).catch(() => null);
    if (!session) return reply.code(401).send();

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let open = true;
    const sink: NotificationSocket = {
      get readyState() {
        return open ? 1 : 3;
      },
      send(data: string) {
        if (open) raw.write(`data: ${data}\n\n`);
      },
    };
    if (!hub.add(session.user.id, sink)) {
      open = false;
      raw.end();
      return;
    }

    const keepAlive = setInterval(() => {
      if (open) raw.write(':\n\n');
    }, 20_000);
    keepAlive.unref();
    const close = () => {
      if (!open) return;
      open = false;
      clearInterval(keepAlive);
      hub.remove(session.user.id, sink);
    };
    request.raw.on('close', close);
    raw.on('error', close);
  });

  fastify.get('/api/v1/auth/notifications/stream', { websocket: true }, (socket, request) => {
    const token = request.cookies?.['ci_access'];
    if (!token) {
      socket.close(1008, 'unauthorized');
      return;
    }
    void authentication.restore(token).then((session) => {
      if (!hub.add(session.user.id, socket)) {
        socket.close(1008, 'too-many');
        return;
      }
      socket.on('close', () => hub.remove(session.user.id, socket));
    }).catch(() => socket.close(1008, 'unauthorized'));
  });

  fastify.post('/api/v1/auth/notifications/webhook', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (secret.length < 32) return reply.code(404).send();
    const raw = typeof request.body === 'string' ? request.body : '';
    const timestamp = header(request, 'x-ci-timestamp');
    const nonce = header(request, 'x-ci-nonce');
    const signature = header(request, 'x-ci-signature');
    if (!webhookTimestampFresh(timestamp, Date.now()) || !webhookSignaturesMatch(signWebhook(secret, timestamp, nonce, raw), signature)) {
      return reply.code(401).send();
    }
    if (!await nonces.claim(nonce, 600)) return reply.code(401).send();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return reply.code(400).send();
    }
    if (!isNotificationRequestedV1(payload)) return reply.code(400).send();
    await notifications.record(payload);
    return reply.code(202).send();
  });
};
