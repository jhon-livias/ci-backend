ALTER TABLE "teacher_profiles" ADD COLUMN "academicDegree" VARCHAR(120);

CREATE TYPE "ClassKind" AS ENUM ('SYNCHRONOUS', 'ASYNCHRONOUS');
CREATE TYPE "AcademicGroupKind" AS ENUM ('CLASSES', 'PROFICIENCY');
CREATE TYPE "AcademicGroupStatus" AS ENUM ('CREATED', 'RESCHEDULED', 'OPENED', 'COMPLETED');

CREATE TABLE "schedule_combos" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_combos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_combos_number_key" ON "schedule_combos"("number");

CREATE TABLE "schedule_slots" (
    "id" UUID NOT NULL,
    "comboId" UUID NOT NULL,
    "day" VARCHAR(16) NOT NULL,
    "classKind" "ClassKind" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,

    CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "schedule_slots_comboId_idx" ON "schedule_slots"("comboId");
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "schedule_combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic_groups" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "kind" "AcademicGroupKind" NOT NULL,
    "status" "AcademicGroupStatus" NOT NULL DEFAULT 'CREATED',
    "language" VARCHAR(80) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "modality" VARCHAR(80) NOT NULL,
    "studyType" VARCHAR(80) NOT NULL,
    "meetUrl" VARCHAR(255) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "teacherUserId" UUID NOT NULL,
    "teacherDocument" VARCHAR(16) NOT NULL,
    "teacherName" VARCHAR(200) NOT NULL,
    "dayComboId" UUID,
    "hourComboId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_groups_code_key" ON "academic_groups"("code");
CREATE INDEX "academic_groups_status_kind_idx" ON "academic_groups"("status", "kind");
ALTER TABLE "academic_groups" ADD CONSTRAINT "academic_groups_dayComboId_fkey" FOREIGN KEY ("dayComboId") REFERENCES "schedule_combos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_groups" ADD CONSTRAINT "academic_groups_hourComboId_fkey" FOREIGN KEY ("hourComboId") REFERENCES "schedule_combos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
