CREATE TYPE "StudentType" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "faculties" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faculties_code_key" ON "faculties"("code");

CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");
CREATE INDEX "schools_facultyId_idx" ON "schools"("facultyId");

CREATE TABLE "careers" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "careers_code_key" ON "careers"("code");
CREATE INDEX "careers_schoolId_idx" ON "careers"("schoolId");

CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studentCode" VARCHAR(32),
    "type" "StudentType" NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "intranetReference" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");
CREATE UNIQUE INDEX "students_studentCode_key" ON "students"("studentCode");
CREATE UNIQUE INDEX "students_intranetReference_key" ON "students"("intranetReference");
CREATE INDEX "students_type_status_idx" ON "students"("type", "status");

CREATE TABLE "student_academic_profiles" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "facultyId" UUID,
    "schoolId" UUID,
    "careerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_academic_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_academic_profiles_studentId_key" ON "student_academic_profiles"("studentId");

ALTER TABLE "schools" ADD CONSTRAINT "schools_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "careers" ADD CONSTRAINT "careers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
