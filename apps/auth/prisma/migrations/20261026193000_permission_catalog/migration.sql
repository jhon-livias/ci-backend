CREATE TABLE "permission_definitions" (
  "id" UUID NOT NULL,
  "moduleCode" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "permission_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission_functionalities" (
  "id" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "permission_functionalities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "permission_definitions_moduleCode_deletedAt_idx" ON "permission_definitions"("moduleCode", "deletedAt");
CREATE UNIQUE INDEX "permission_definitions_module_name_active_key" ON "permission_definitions"("moduleCode", "name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "permission_functionalities_permissionId_position_key" ON "permission_functionalities"("permissionId", "position");
CREATE UNIQUE INDEX "permission_functionalities_permissionId_name_key" ON "permission_functionalities"("permissionId", "name");

ALTER TABLE "permission_functionalities"
  ADD CONSTRAINT "permission_functionalities_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "permission_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permission_definitions" ("id", "moduleCode", "name", "enabled", "createdAt", "updatedAt")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'registro-academico', 'Control total', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'registro-academico', 'Registro Programas', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "permission_functionalities" ("id", "permissionId", "name", "position")
VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e11', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e01', 'Total', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e12', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Funcionalidad 1', 0),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e13', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4e02', 'Funcionalidad 2', 1);
