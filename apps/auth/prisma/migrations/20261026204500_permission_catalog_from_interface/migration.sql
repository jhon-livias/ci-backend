UPDATE "permission_definitions"
SET "name" = 'Matricularse y ver su historial académico', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01';

UPDATE "permission_definitions"
SET "name" = 'Marcar asistencia y registrar notas', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02';

DELETE FROM "permission_functionalities"
WHERE "id" IN (
  '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e11',
  '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e12',
  '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e13'
);

INSERT INTO "permission_definitions" ("id", "moduleCode", "name", "enabled", "createdAt", "updatedAt")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e03', 'registro-academico', 'Consultar asistencias y alertas', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e04', 'registro-academico', 'Gestionar grupos y combos horarios', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e05', 'registro-academico', 'Justificar faltas de docentes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'registro-academico', 'Gestionar usuarios, catálogos, reglas y tarifas', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e07', 'registro-academico', 'Consultar bitácora y supervisar incidencias', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "permission_functionalities" ("id", "permissionId", "name", "position")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f01', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Registrar matrícula', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f02', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Historial de matrículas', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f03', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Historial académico', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f04', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Historial de pagos', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f05', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Examen de suficiencia', 4),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f06', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Asistencia del docente', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f07', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Asistencia del alumno', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f08', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Justificación de alumnos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f09', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Notas del alumno', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0a', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e03', 'Asistencias y notas de alumnos', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0b', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e03', 'Asistencia de docentes', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0c', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e03', 'Faltas de alumnos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0d', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e04', 'Alumnos', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0e', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e04', 'Gestión de docentes', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f0f', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e04', 'Gestión de grupos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f10', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e04', 'Combo horario', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f11', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e05', 'Seguimiento de docentes', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f12', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e05', 'Justificación de docentes', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f13', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'Usuarios y roles', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f14', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'Catálogos académicos', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f15', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'Reglas del sistema', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f16', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'Combos horario', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f17', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e06', 'Tarifas', 4),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f18', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e07', 'Bitácora', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4f19', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e07', 'Incidencias de pago', 1);
