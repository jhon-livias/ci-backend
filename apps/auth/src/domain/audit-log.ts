import { FIXED_ROLES } from './access-policy.js';

export const AUDIT_MODULES = ['Sesión', 'Usuarios', 'Tipos de usuario', 'Permisos', 'Sedes', 'Configuración académica', 'Tarifas y pagos', 'Grupos', 'Combos horarios'] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_ROLE_NAMES = ['Estudiante', 'Docente', 'Asesora', 'Director', 'Administrador'] as const;
export type AuditRoleName = (typeof AUDIT_ROLE_NAMES)[number];

const ROLE_PRIORITY = ['ADMINISTRATOR', 'DIRECTOR', 'ADVISOR', 'TEACHER', 'STUDENT'] as const;

export const cleanAuditText = (value: string, max: number): string =>
  value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export const roleLabel = (roles: readonly string[]): string => {
  const code = ROLE_PRIORITY.find((role) => roles.includes(role));
  return FIXED_ROLES.find((role) => role.code === code)?.name ?? 'Usuario';
};

export const isAuditModule = (value: string): value is AuditModule => AUDIT_MODULES.some((module) => module === value);

export const isAuditRoleName = (value: string): value is AuditRoleName => AUDIT_ROLE_NAMES.some((role) => role === value);
