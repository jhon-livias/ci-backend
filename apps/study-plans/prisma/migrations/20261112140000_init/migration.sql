CREATE SCHEMA IF NOT EXISTS "study_plans";

CREATE TYPE "study_plans"."CurriculumStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "study_plans"."SyllabusStatus" AS ENUM ('PUBLISHED', 'RETIRED');

CREATE TABLE "study_plans"."modalities" (
  "id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "modalities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "modalities_code_key" ON "study_plans"."modalities"("code");

CREATE TABLE "study_plans"."academic_areas" (
  "id" UUID NOT NULL,
  "code" VARCHAR(12) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "academic_areas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_areas_code_key" ON "study_plans"."academic_areas"("code");

CREATE TABLE "study_plans"."careers" (
  "id" UUID NOT NULL,
  "areaId" UUID NOT NULL,
  "code" VARCHAR(12) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "careers_code_key" ON "study_plans"."careers"("code");
CREATE INDEX "careers_areaId_idx" ON "study_plans"."careers"("areaId");
ALTER TABLE "study_plans"."careers" ADD CONSTRAINT "careers_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "study_plans"."academic_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "study_plans"."curricula" (
  "id" UUID NOT NULL,
  "careerId" UUID NOT NULL,
  "modalityId" UUID NOT NULL,
  "year" VARCHAR(4) NOT NULL,
  "status" "study_plans"."CurriculumStatus" NOT NULL DEFAULT 'INACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curricula_careerId_modalityId_year_key" ON "study_plans"."curricula"("careerId", "modalityId", "year");
CREATE INDEX "curricula_careerId_status_idx" ON "study_plans"."curricula"("careerId", "status");
ALTER TABLE "study_plans"."curricula" ADD CONSTRAINT "curricula_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "study_plans"."careers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study_plans"."curricula" ADD CONSTRAINT "curricula_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "study_plans"."modalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "study_plans"."cycles" (
  "id" UUID NOT NULL,
  "curriculumId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cycles_curriculumId_number_key" ON "study_plans"."cycles"("curriculumId", "number");
ALTER TABLE "study_plans"."cycles" ADD CONSTRAINT "cycles_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "study_plans"."curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "study_plans"."courses" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "code" VARCHAR(16) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "credits" DECIMAL(4,1) NOT NULL,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "courses_cycleId_position_key" ON "study_plans"."courses"("cycleId", "position");
CREATE UNIQUE INDEX "courses_cycleId_code_key" ON "study_plans"."courses"("cycleId", "code");
ALTER TABLE "study_plans"."courses" ADD CONSTRAINT "courses_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "study_plans"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "study_plans"."syllabi" (
  "id" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "study_plans"."SyllabusStatus" NOT NULL,
  "content" BYTEA NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "syllabi_courseId_version_key" ON "study_plans"."syllabi"("courseId", "version");
CREATE INDEX "syllabi_courseId_status_idx" ON "study_plans"."syllabi"("courseId", "status");
ALTER TABLE "study_plans"."syllabi" ADD CONSTRAINT "syllabi_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "study_plans"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "study_plans"."modalities" ("id", "code", "name") VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b01', 'DISTANCIA', 'PREGRADO-A DISTANCIA'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b02', 'SEMIPRESENCIAL', 'PUEDE-SEMIPRESENCIAL'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b03', 'PRESENCIAL', 'PREGRADO-PRESENCIAL');

INSERT INTO "study_plans"."academic_areas" ("id", "code", "name") VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b10', 'I', 'INGENIERIA'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b11', 'C', 'CIENCIAS EMPRESARIALES');

INSERT INTO "study_plans"."careers" ("id", "areaId", "code", "name") VALUES
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b20', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b10', 'IC', 'INGENIERÍA CIVIL'),
  ('6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b21', '6f1c2a40-7b2e-4c1a-9d11-0a1b2c3d4b10', 'AU', 'ARQUITECTURA Y URBANISMO');
