CREATE TABLE "user_type_definitions" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "moduleCode" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "user_type_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_type_permissions" (
  "id" UUID NOT NULL,
  "userTypeId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "user_type_permissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_type_definitions_deletedAt_idx" ON "user_type_definitions"("deletedAt");
CREATE UNIQUE INDEX "user_type_definitions_name_active_key" ON "user_type_definitions"("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "user_type_permissions_userTypeId_position_key" ON "user_type_permissions"("userTypeId", "position");
CREATE UNIQUE INDEX "user_type_permissions_userTypeId_name_key" ON "user_type_permissions"("userTypeId", "name");

ALTER TABLE "user_type_permissions"
  ADD CONSTRAINT "user_type_permissions_userTypeId_fkey"
  FOREIGN KEY ("userTypeId") REFERENCES "user_type_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_type_definitions" ("id", "name", "moduleCode", "enabled", "createdAt", "updatedAt")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Estudiante', 'estudiante', true, '2026-10-26 16:00:01', '2026-10-26 16:00:01'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02', 'Docente', 'docente', true, '2026-10-26 16:00:02', '2026-10-26 16:00:02'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a03', 'Asesora', 'asesora', true, '2026-10-26 16:00:03', '2026-10-26 16:00:03'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Director', 'director', true, '2026-10-26 16:00:04', '2026-10-26 16:00:04'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a05', 'Administrador', 'administrador', true, '2026-10-26 16:00:05', '2026-10-26 16:00:05');

INSERT INTO "user_type_permissions" ("id", "userTypeId", "name", "position")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b01', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Registrar matrícula', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b02', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Historial de matrículas', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b03', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Historial académico', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b04', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Historial de pagos', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b05', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a01', 'Examen de suficiencia', 4),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b06', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02', 'Asistencia del docente', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b07', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02', 'Asistencia del alumno', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b08', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02', 'Justificación de alumnos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b09', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a02', 'Notas del alumno', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0a', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a03', 'Asistencias y notas de alumnos', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0b', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a03', 'Asistencia de docentes', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0c', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a03', 'Faltas de alumnos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0d', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Alumnos', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0e', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Gestión de docentes', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b0f', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Seguimiento de docentes', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b10', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Justificación de docentes', 3),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b11', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Gestión de grupos', 4),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b12', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a04', 'Combo horario', 5),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b13', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a05', 'Usuarios y roles', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b14', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a05', 'Configuración académica', 1),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b15', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a05', 'Tarifas y pagos', 2),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6b16', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d6a05', 'Bitácora', 3);
