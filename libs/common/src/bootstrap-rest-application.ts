import { ValidationPipe, VersioningType, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';

import type { ServiceName } from '../../contracts/src/index.js';
import { resolveRedisEndpoint } from './redis-endpoint.js';
import { shutdownTelemetry, startTelemetry } from './telemetry.js';

const ports: Record<ServiceName, number> = {
  gateway: 3000,
  auth: 3001,
  academic: 3002,
  students: 3003,
  enrollment: 3004,
  'attendance-grades': 3005,
  exams: 3006,
  payments: 3007,
};

const parseAllowedOrigins = (): string[] =>
  (process.env.APP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const bootstrapRestApplication = async (
  rootModule: Type<unknown>,
  service: ServiceName,
  configure?: (application: NestFastifyApplication) => Promise<void>,
): Promise<void> => {
  startTelemetry(service);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const redisEndpoint = resolveRedisEndpoint(process.env);
  const redis = redisEndpoint
    ? new Redis({
        host: redisEndpoint.host,
        port: redisEndpoint.port,
        password: redisEndpoint.password,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
      })
    : undefined;
  const app = await NestFactory.create<NestFastifyApplication>(
    rootModule,
    new FastifyAdapter({
      logger: {
        level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-csrf-token"]',
            'req.headers["x-internal-secret"]',
            'req.body.password',
          ],
          censor: '[redacted]',
        },
      },
    }),
    { bufferLogs: true },
  );
  const allowedOrigins = parseAllowedOrigins();

  await app.register(fastifyCors, {
    origin: allowedOrigins.length === 0 ? false : allowedOrigins,
    credentials: allowedOrigins.length > 0,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: isDevelopment
      ? false
      : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    referrerPolicy: { policy: 'no-referrer' },
  });
  app.getHttpAdapter().getInstance().addHook('onSend', async (_request, reply, payload) => {
    void reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    return payload;
  });
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    ...(redis ? { redis, nameSpace: `ci-${service}-` } : {}),
  });
  if (redis) {
    app.getHttpAdapter().getInstance().addHook('onClose', async () => {
      await redis.quit();
    });
  } else {
    app.getHttpAdapter().getInstance().log.warn('REDIS_HOST no está definido: el límite de peticiones queda en memoria de este proceso.');
  }

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().addHook('onClose', async () => {
    await shutdownTelemetry();
  });

  if (configure) {
    await configure(app);
  }

  if (isDevelopment) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle(`${service} API`).setVersion('1').build(),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { supportedSubmitMethods: [] },
    });
  }

  const configuredPort = Number(process.env[`${service.toUpperCase().replaceAll('-', '_')}_PORT`]);
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number.isSafeInteger(configuredPort) ? configuredPort : ports[service],
  });
};
