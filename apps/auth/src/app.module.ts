import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { createHealthController } from '../../../libs/common/src/index.js';
import { AuthenticationService } from './application/authentication.service.js';
import { AuthController } from './interfaces/http/auth.controller.js';
import { AuthPrismaService } from './infrastructure/persistence/auth-prisma.service.js';
import { AccessPolicyController } from './interfaces/http/access-policy.controller.js';
import { AccessPolicyGuard, ModulesReadGuard, UsersReadGuard } from './interfaces/http/access-policy.guard.js';
import { UserDirectoryService } from './application/user-directory.service.js';
import { UserDirectoryController } from './interfaces/http/user-directory.controller.js';
import { SystemModulesController } from './interfaces/http/system-modules.controller.js';
import { SitesProxyController } from './interfaces/http/sites-proxy.controller.js';
import { NotificationsController } from './interfaces/http/notifications.controller.js';
import { NotificationService } from './application/notification.service.js';
import { NotificationHub } from './infrastructure/notifications/notification-hub.js';
import { WebhookNotificationChannel } from './infrastructure/notifications/webhook-notification.channel.js';
import { NotificationDeliveryWorker } from './infrastructure/notifications/notification-delivery.worker.js';
import { RabbitNotificationBridge } from './infrastructure/notifications/rabbit-notification.bridge.js';
import { NonceStore } from './infrastructure/notifications/nonce-store.js';

const HealthController = createHealthController('auth');
const accessTokenSecret = process.env.AUTH_JWT_ACCESS_SECRET;

if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error('AUTH_JWT_ACCESS_SECRET debe tener al menos 32 caracteres.');
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: accessTokenSecret,
      signOptions: { algorithm: 'HS256', expiresIn: '15m' },
    }),
  ],
  controllers: [HealthController, AuthController, AccessPolicyController, UserDirectoryController, SystemModulesController, SitesProxyController, NotificationsController],
  providers: [AuthPrismaService, AuthenticationService, AccessPolicyGuard, UsersReadGuard, ModulesReadGuard, UserDirectoryService, NotificationHub, WebhookNotificationChannel, NonceStore, NotificationService, NotificationDeliveryWorker, RabbitNotificationBridge],
})
export class AppModule {}
