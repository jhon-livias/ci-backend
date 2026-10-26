import { bootstrapRestApplication } from '../../../libs/common/src/index.js';
import fastifyHttpProxy from '@fastify/http-proxy';

import { AppModule } from './app.module.js';

void bootstrapRestApplication(AppModule, 'gateway', async (application) => {
  await application.register(fastifyHttpProxy, {
    upstream: process.env.AUTH_UPSTREAM ?? 'http://auth:3001',
    prefix: '/api/v1/auth',
    rewritePrefix: '/api/v1/auth',
    websocket: true,
  });
});
