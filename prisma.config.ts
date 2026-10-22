import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'apps/auth/prisma/schema.prisma',
  migrations: {
    path: 'apps/auth/prisma/migrations',
  },
  datasource: {
    url: env('AUTH_DATABASE_URL'),
  },
});
