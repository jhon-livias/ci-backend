CREATE TABLE "student_justifications" (
  "id" UUID NOT NULL,
  "attendanceId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "objectKey" VARCHAR(255),
  "fileName" VARCHAR(160),
  "contentType" VARCHAR(100),
  "sizeBytes" INTEGER,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_justifications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "teacher_absences" (
  "id" UUID NOT NULL,
  "teacherUserId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "groupCode" VARCHAR(16) NOT NULL,
  "language" VARCHAR(80) NOT NULL,
  "level" VARCHAR(80) NOT NULL,
  "occurredOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_absences_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "teacher_justifications" (
  "id" UUID NOT NULL,
  "teacherAbsenceId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "objectKey" VARCHAR(255) NOT NULL,
  "fileName" VARCHAR(160) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_justifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_justifications_attendanceId_key" ON "student_justifications"("attendanceId");
CREATE UNIQUE INDEX "teacher_absences_teacherUserId_groupId_occurredOn_key" ON "teacher_absences"("teacherUserId", "groupId", "occurredOn");
CREATE UNIQUE INDEX "teacher_justifications_teacherAbsenceId_key" ON "teacher_justifications"("teacherAbsenceId");
