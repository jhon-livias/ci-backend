import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NOTIFICATION_REQUESTED_V1, isNotificationRequestedV1 } from '../../../../../libs/contracts/src/notification-requested.v1.js';
import { RabbitEventBus, resolveRabbitEndpoint } from '../../../../../libs/common/src/rabbit-event-bus.js';
import { NotificationService } from '../../application/notification.service.js';

@Injectable()
export class RabbitNotificationBridge implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitNotificationBridge.name);
  private bus: RabbitEventBus | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly notifications: NotificationService) {}

  onModuleInit(): void {
    const endpoint = resolveRabbitEndpoint(process.env);
    if (!endpoint) {
      this.logger.warn('RABBITMQ_HOST no está definido: los eventos de notificación entre servicios quedan en pausa.');
      return;
    }
    this.bus = new RabbitEventBus(endpoint);
    void this.listen();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.retry) clearTimeout(this.retry);
    await this.bus?.close();
  }

  private async listen(): Promise<void> {
    if (!this.bus) return;
    try {
      await this.bus.subscribe('auth.notification.requested.v1', NOTIFICATION_REQUESTED_V1, async (payload) => {
        if (!isNotificationRequestedV1(payload)) throw new Error('Contrato de notificación inválido.');
        await this.notifications.record(payload);
      });
    } catch (error) {
      this.logger.warn(`No se pudo suscribir a notificaciones: ${error instanceof Error ? error.message : 'error'}`);
      this.retry = setTimeout(() => void this.listen(), 5000);
    }
  }
}
