/** Versioned, read-only inventory. Status describes implementation, not authorization. */
export const SYSTEM_MODULES = [
  { code: 'auth', name: 'Autenticación y sesión', description: 'Inicio, restauración y cierre de sesión.', status: 'IN_PROGRESS' },
  { code: 'users', name: 'Usuarios y perfiles', description: 'Cuentas y datos generales vinculados a cada persona.', status: 'IN_PROGRESS' },
  { code: 'roles', name: 'Roles y permisos', description: 'Roles fijos y autorización granular por acción y recurso.', status: 'IN_PROGRESS' },
  { code: 'sites', name: 'Sedes', description: 'Organización de la sede Trujillo y futuras sedes.', status: 'IN_PROGRESS' },
  { code: 'people', name: 'Estudiantes y docentes', description: 'Datos de alumnos y docentes del Centro de Idiomas.', status: 'PLANNED' },
  { code: 'academic', name: 'Oferta académica', description: 'Idiomas, niveles, equivalencias, grupos y horarios.', status: 'PLANNED' },
  { code: 'enrollment', name: 'Matrículas', description: 'Matrículas web y manuales e historial académico.', status: 'PLANNED' },
  { code: 'attendance', name: 'Asistencias y justificaciones', description: 'Control de asistencia y sustento de faltas.', status: 'PLANNED' },
  { code: 'grades', name: 'Notas y actas', description: 'Registro de calificaciones y generación de actas.', status: 'PLANNED' },
  { code: 'exams', name: 'Exámenes de suficiencia', description: 'Inscripciones, programación y resultados de exámenes.', status: 'PLANNED' },
  { code: 'payments', name: 'Pagos y comprobantes', description: 'Pagos, historial y comprobantes del estudiante.', status: 'PLANNED' },
  { code: 'reports', name: 'Reportes y auditoría', description: 'Seguimiento de operaciones y eventos de seguridad.', status: 'PLANNED' },
  { code: 'integrations', name: 'Integraciones', description: 'Conexiones institucionales y proveedores externos.', status: 'PLANNED' },
] as const;
