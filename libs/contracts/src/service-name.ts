export const serviceNames = [
  'gateway',
  'auth',
  'academic',
  'students',
  'enrollment',
  'attendance-grades',
  'exams',
  'payments',
] as const;

export type ServiceName = (typeof serviceNames)[number];
