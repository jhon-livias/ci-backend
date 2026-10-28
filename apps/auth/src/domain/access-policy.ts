/** The only permissions enforced so far. New capabilities require reviewed code and tests. */
export const ACCESS_PERMISSIONS = [
  { code: 'access_policy.read', description: 'Consultar roles y permisos definidos.' },
  { code: 'users.read', description: 'Consultar cuentas de usuario.' },
  { code: 'users.create', description: 'Crear cuentas de usuario.' },
  { code: 'users.update', description: 'Modificar cuentas de usuario.' },
  { code: 'users.delete', description: 'Eliminar cuentas de usuario.' },
  { code: 'modules.read', description: 'Consultar el catálogo de módulos.' },
  { code: 'audit.read', description: 'Consultar la bitácora de acciones.' },
  { code: 'sites.read', description: 'Consultar sedes.' },
  { code: 'sites.create', description: 'Crear sedes.' },
  { code: 'sites.update', description: 'Modificar sedes.' },
  { code: 'sites.delete', description: 'Eliminar sedes.' },
  { code: 'academic_config.read', description: 'Consultar catálogos y reglas académicas.' },
  { code: 'academic_config.update', description: 'Modificar catálogos y reglas académicas.' },
  { code: 'payments.read', description: 'Consultar tarifas e incidencias de pago.' },
  { code: 'payments.update', description: 'Modificar tarifas y resolver incidencias de pago.' },
  { code: 'attendance.read', description: 'Consultar asistencias, notas y faltas para seguimiento.' },
  { code: 'teachers.read', description: 'Consultar docentes del centro.' },
  { code: 'teachers.create', description: 'Registrar docentes del centro.' },
  { code: 'teachers.update', description: 'Modificar docentes del centro.' },
  { code: 'teachers.delete', description: 'Eliminar docentes del centro.' },
  { code: 'groups.read', description: 'Consultar grupos y combos horarios.' },
  { code: 'groups.update', description: 'Crear y actualizar grupos y combos horarios.' },
  { code: 'teaching.read', description: 'Consultar los grupos asignados al docente.' },
  { code: 'teaching.update', description: 'Registrar asistencia, justificaciones y notas de sus grupos.' },
  { code: 'enrollment.read', description: 'Consultar matrículas, pagos y exámenes propios.' },
  { code: 'enrollment.update', description: 'Registrar matrícula, solicitud de grupo y examen de suficiencia.' },
  { code: 'permissions.read', description: 'Consultar el catálogo de permisos.' },
  { code: 'permissions.create', description: 'Crear permisos del catálogo.' },
  { code: 'permissions.update', description: 'Modificar permisos del catálogo.' },
  { code: 'permissions.delete', description: 'Eliminar permisos del catálogo.' },
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number]['code'];
export type FixedRole = 'STUDENT' | 'TEACHER' | 'ADVISOR' | 'DIRECTOR' | 'ADMINISTRATOR';

export const FIXED_ROLES: readonly { readonly code: FixedRole; readonly name: string; readonly description: string }[] = [
  { code: 'STUDENT', name: 'Estudiante', description: 'Consulta su información y realiza sus trámites.' },
  { code: 'TEACHER', name: 'Docente', description: 'Trabaja con sus grupos asignados.' },
  { code: 'ADVISOR', name: 'Asesora', description: 'Realiza seguimiento académico de consulta.' },
  { code: 'DIRECTOR', name: 'Director', description: 'Gestiona la operación académica autorizada.' },
  { code: 'ADMINISTRATOR', name: 'Administrador', description: 'Supervisa el sistema y administra accesos autorizados.' },
];

const ROLE_PERMISSIONS: Readonly<Record<FixedRole, readonly AccessPermission[]>> = {
  STUDENT: ['enrollment.read', 'enrollment.update'],
  TEACHER: ['teaching.read', 'teaching.update'],
  ADVISOR: ['attendance.read'],
  DIRECTOR: ['attendance.read', 'teachers.read', 'teachers.create', 'teachers.update', 'teachers.delete', 'groups.read', 'groups.update'],
  ADMINISTRATOR: ['access_policy.read', 'users.read', 'users.create', 'users.update', 'users.delete', 'modules.read', 'audit.read', 'sites.read', 'sites.create', 'sites.update', 'sites.delete', 'academic_config.read', 'academic_config.update', 'payments.read', 'payments.update', 'permissions.read', 'permissions.create', 'permissions.update', 'permissions.delete'],
};

export const hasAccessPermission = (roles: readonly FixedRole[], permission: AccessPermission): boolean =>
  roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false);

export const accessPolicyCatalog = () => ({
  roles: FIXED_ROLES.map((role) => ({ ...role, permissions: ROLE_PERMISSIONS[role.code] })),
  permissions: ACCESS_PERMISSIONS,
});
