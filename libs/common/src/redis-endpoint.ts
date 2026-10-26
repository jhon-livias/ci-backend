export interface RedisEndpoint {
  readonly host: string;
  readonly port: number;
  readonly password: string;
}

/** Exige Redis en producción. En otros entornos, sin host configurado, el límite queda en memoria. */
export const resolveRedisEndpoint = (env: NodeJS.ProcessEnv): RedisEndpoint | undefined => {
  const host = env.REDIS_HOST?.trim() ?? '';
  const password = env.REDIS_PASSWORD ?? '';
  if (!host && !password) {
    if (env.NODE_ENV === 'production') {
      throw new Error('REDIS_HOST y REDIS_PASSWORD son obligatorios en producción.');
    }
    return undefined;
  }
  if (!host || password.length < 12) {
    throw new Error('REDIS_HOST y REDIS_PASSWORD (mínimo 12 caracteres) deben configurarse juntos.');
  }
  const port = Number(env.REDIS_PORT ?? '6379');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REDIS_PORT no es válido.');
  }
  return { host, port, password };
};
