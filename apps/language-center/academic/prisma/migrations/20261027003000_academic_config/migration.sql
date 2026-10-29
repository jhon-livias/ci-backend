CREATE TYPE "AcademicCatalogKind" AS ENUM ('LANGUAGE', 'LEVEL', 'STUDY_TYPE', 'MODALITY', 'GROUP_TYPE');

CREATE TABLE "academic_catalog_items" (
    "id" UUID NOT NULL,
    "kind" "AcademicCatalogKind" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "academic_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_catalog_items_kind_position_idx" ON "academic_catalog_items"("kind", "position");

CREATE UNIQUE INDEX "academic_catalog_items_kind_name_active_key" ON "academic_catalog_items"("kind", "name") WHERE "deletedAt" IS NULL;

CREATE TABLE "academic_rules" (
    "id" UUID NOT NULL,
    "minStudents" INTEGER NOT NULL,
    "maxStudents" INTEGER NOT NULL,
    "absencePercent" INTEGER NOT NULL,
    "passingGrade" INTEGER NOT NULL,
    "evaluationsPerGroup" INTEGER NOT NULL,
    "maxScorePerEvaluation" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_rules_pkey" PRIMARY KEY ("id")
);

INSERT INTO "academic_catalog_items" ("id", "kind", "name", "position") VALUES
    ('a1000001-0000-4000-8000-000000000001', 'LANGUAGE', 'Inglés', 0),
    ('a1000001-0000-4000-8000-000000000002', 'LANGUAGE', 'Francés', 1),
    ('a1000001-0000-4000-8000-000000000003', 'LANGUAGE', 'Portugués', 2),
    ('b1000001-0000-4000-8000-000000000001', 'LEVEL', 'Básico 1', 0),
    ('b1000001-0000-4000-8000-000000000002', 'LEVEL', 'Básico 2', 1),
    ('b1000001-0000-4000-8000-000000000003', 'LEVEL', 'Intermedio 1', 2),
    ('b1000001-0000-4000-8000-000000000004', 'LEVEL', 'Intermedio 2', 3),
    ('b1000001-0000-4000-8000-000000000005', 'LEVEL', 'Avanzado', 4),
    ('c1000001-0000-4000-8000-000000000001', 'STUDY_TYPE', 'Regular', 0),
    ('c1000001-0000-4000-8000-000000000002', 'STUDY_TYPE', 'Intensivo', 1),
    ('d1000001-0000-4000-8000-000000000001', 'MODALITY', 'Virtual', 0),
    ('d1000001-0000-4000-8000-000000000002', 'MODALITY', 'Presencial', 1),
    ('e1000001-0000-4000-8000-000000000001', 'GROUP_TYPE', 'Clases', 0),
    ('e1000001-0000-4000-8000-000000000002', 'GROUP_TYPE', 'Suficiencia', 1);

INSERT INTO "academic_rules" ("id", "minStudents", "maxStudents", "absencePercent", "passingGrade", "evaluationsPerGroup", "maxScorePerEvaluation", "updatedAt")
VALUES ('f1000001-0000-4000-8000-000000000001', 31, 50, 30, 60, 5, 20, CURRENT_TIMESTAMP);
