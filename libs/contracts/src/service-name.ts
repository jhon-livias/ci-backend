export const serviceNames = [
  'gateway',
  'auth',
  'academic',
  'students',
  'enrollment',
  'attendance-grades',
  'exams',
  'payments',
  'tickets',
] as const;

export type ServiceName = (typeof serviceNames)[number];
