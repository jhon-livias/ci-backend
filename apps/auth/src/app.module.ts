import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { createHealthController } from '../../../libs/common/src/index.js';
import { AuthenticationService } from './application/authentication.service.js';
import { AuthController } from './interfaces/http/auth.controller.js';
import { AuthPrismaService } from './infrastructure/persistence/auth-prisma.service.js';

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
  controllers: [HealthController, AuthController],
  providers: [AuthPrismaService, AuthenticationService],
})
export class AppModule {}
