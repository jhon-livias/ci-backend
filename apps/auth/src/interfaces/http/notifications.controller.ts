import { Controller, Get, Header, Req, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthenticationService } from '../../application/authentication.service.js';
import { NotificationService } from '../../application/notification.service.js';

@Controller('auth/notifications')
export class NotificationsController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly notifications: NotificationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: FastifyRequest) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.authentication.restore(token);
    return { notifications: await this.notifications.list(session.user.id) };
  }
}
