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
  await application.register(fastifyHttpProxy, {
    upstream: process.env.TICKETS_UPSTREAM ?? 'http://tickets:3008',
    prefix: '/api/v1/tickets',
    rewritePrefix: '/api/v1/tickets',
  });
  await application.register(fastifyHttpProxy, {
    upstream: process.env.STUDY_PLANS_UPSTREAM ?? 'http://study-plans:3009',
    prefix: '/api/v1/study-plans',
    rewritePrefix: '/api/v1/study-plans',
  });
}, { bodyLimit: 12 * 1024 * 1024 });
