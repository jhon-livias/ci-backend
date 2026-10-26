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
  controllers: [HealthController, AuthController, AccessPolicyController, UserDirectoryController, SystemModulesController, SitesProxyController],
  providers: [AuthPrismaService, AuthenticationService, AccessPolicyGuard, UsersReadGuard, ModulesReadGuard, UserDirectoryService],
})
export class AppModule {}
