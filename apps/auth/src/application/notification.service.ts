import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { trace } from '@opentelemetry/api';
import { NOTIFICATION_REQUESTED_V1, isNotificationRequestedV1, type NotificationRequestedV1 } from '../../../../libs/contracts/src/notification-requested.v1.js';
import { RabbitEventBus, resolveRabbitEndpoint } from '../../../../libs/common/src/rabbit-event-bus.js';
import { resolveRedisEndpoint } from '../../../../libs/common/src/redis-endpoint.js';
import { parseNotificationTransports } from '../domain/notification.js';
import { AuthPrismaService } from '../infrastructure/persistence/auth-prisma.service.js';
import { NotificationHub, type NotificationPush } from '../infrastructure/notifications/notification-hub.js';
import { WebhookNotificationChannel } from '../infrastructure/notifications/webhook-notification.channel.js';

const tracer = trace.getTracer('ci-auth');

export interface InboxNotification extends NotificationPush {}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly transports = parseNotificationTransports(process.env.NOTIFICATION_TRANSPORTS);
  private queue: Queue<{ id: string }> | undefined;
  private rabbit: RabbitEventBus | undefined;

  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly hub: NotificationHub,
    private readonly webhook: WebhookNotificationChannel,
  ) {}

  async record(input: NotificationRequestedV1): Promise<void> {
    if (!isNotificationRequestedV1(input)) throw new Error('El evento de notificación no es válido.');
    await tracer.startActiveSpan('notification.record', async (span) => {
      span.setAttribute('notification.id', input.id);
      span.setAttribute('correlation.id', input.correlationId);
      try {
        const user = await this.prisma.user.findFirst({ where: { id: input.recipientUserId, deletedAt: null }, select: { id: true } });
        if (!user) return;
        try {
          await this.prisma.userNotification.create({
            data: {
              id: input.id,
              userId: input.recipientUserId,
              title: input.title,
              body: input.body,
              correlationId: input.correlationId,
              createdAt: new Date(input.createdAt),
            },
          });
        } catch (error) {
          if (isUniqueConflict(error)) return;
          throw error;
        }
        await this.enqueue(input.id);
      } finally {
        span.end();
      }
    });
  }

  async list(userId: string): Promise<readonly InboxNotification[]> {
    const rows = await this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, createdAt: true, readAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      unread: row.readAt === null,
    }));
  }

  async deliver(id: string): Promise<void> {
    const row = await this.prisma.userNotification.findUnique({ where: { id } });
    if (!row) return;
    const notification = {
      id: row.id,
      recipientUserId: row.userId,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      correlationId: row.correlationId,
      unread: row.readAt === null,
    };
    if (this.transports.includes('websocket')) this.hub.push(row.userId, notification);
    if (this.transports.includes('webhook')) await this.webhook.deliver(notification);
  }

  async publish(input: NotificationRequestedV1): Promise<void> {
    const endpoint = resolveRabbitEndpoint(process.env);
    if (!endpoint) return;
    this.rabbit ??= new RabbitEventBus(endpoint);
    await this.rabbit.publish(NOTIFICATION_REQUESTED_V1, input, input.correlationId);
  }

  private async enqueue(id: string): Promise<void> {
    const endpoint = resolveRedisEndpoint(process.env);
    if (!endpoint) {
      await this.deliver(id);
      return;
    }
    this.queue ??= new Queue<{ id: string }>('notification.deliver', {
      connection: { host: endpoint.host, port: endpoint.port, password: endpoint.password, maxRetriesPerRequest: null },
    });
    try {
      await this.queue.add('deliver', { id }, {
        jobId: id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
      });
    } catch (error) {
      this.logger.warn(`No se pudo encolar la notificación ${id}: ${error instanceof Error ? error.message : 'error'}`);
      await this.deliver(id);
    }
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
