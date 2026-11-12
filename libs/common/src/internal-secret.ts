import { timingSafeEqual } from 'node:crypto';

export type InternalService = 'academic' | 'students' | 'enrollment' | 'attendance' | 'payments';

const SECRET_ENV: Record<InternalService, string> = {
  academic: 'ACADEMIC_INTERNAL_SECRET',
  students: 'STUDENTS_INTERNAL_SECRET',
  enrollment: 'ENROLLMENT_INTERNAL_SECRET',
  attendance: 'ATTENDANCE_INTERNAL_SECRET',
  payments: 'PAYMENTS_INTERNAL_SECRET',
};

const HOST_SERVICE: Record<string, InternalService> = {
  academic: 'academic',
  students: 'students',
  enrollment: 'enrollment',
  'attendance-grades': 'attendance',
  payments: 'payments',
};

export const internalSecret = (service: InternalService, env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const value = env[SECRET_ENV[service]]?.trim() ?? '';
  return value.length >= 32 ? value : undefined;
};

export const internalSecretMatches = (
  service: InternalService,
  supplied: unknown,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const expected = internalSecret(service, env);
  if (!expected || typeof supplied !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const internalSecretForUpstream = (upstream: string, env: NodeJS.ProcessEnv = process.env): string | undefined => {
  let host = '';
  try {
    host = new URL(upstream).hostname;
  } catch {
    host = '';
  }
  const service = HOST_SERVICE[host];
  return service ? internalSecret(service, env) : undefined;
};
