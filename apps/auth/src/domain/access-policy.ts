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
  STUDENT: [],
  TEACHER: [],
  ADVISOR: [],
  DIRECTOR: [],
  ADMINISTRATOR: ['access_policy.read', 'users.read', 'users.create', 'users.update', 'users.delete', 'modules.read', 'audit.read', 'sites.read', 'sites.create', 'sites.update', 'sites.delete', 'permissions.read', 'permissions.create', 'permissions.update', 'permissions.delete'],
};

export const hasAccessPermission = (roles: readonly FixedRole[], permission: AccessPermission): boolean =>
  roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false);

export const accessPolicyCatalog = () => ({
  roles: FIXED_ROLES.map((role) => ({ ...role, permissions: ROLE_PERMISSIONS[role.code] })),
  permissions: ACCESS_PERMISSIONS,
});
