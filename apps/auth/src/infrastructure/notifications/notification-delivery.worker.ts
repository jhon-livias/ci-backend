import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { resolveRedisEndpoint } from '../../../../../libs/common/src/redis-endpoint.js';
import { NotificationService } from '../../application/notification.service.js';

@Injectable()
export class NotificationDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  private worker: Worker<{ id: string }> | undefined;

  constructor(private readonly notifications: NotificationService) {}

  onModuleInit(): void {
    const endpoint = resolveRedisEndpoint(process.env);
    if (!endpoint) return;
    const connection = { host: endpoint.host, port: endpoint.port, password: endpoint.password, maxRetriesPerRequest: null };
    this.worker = new Worker<{ id: string }>('notification.deliver', (job) => this.deliver(job), { connection });
    this.worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      this.logger.warn(`Notificación ${job.data.id} agotó los reintentos: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async deliver(job: Job<{ id: string }>): Promise<void> {
    await this.notifications.deliver(job.data.id);
  }
}
