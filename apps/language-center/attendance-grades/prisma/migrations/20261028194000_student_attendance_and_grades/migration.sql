CREATE TYPE "StudentAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED_ABSENCE', 'LATE');

CREATE TABLE "student_attendance" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "groupCode" VARCHAR(16) NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "studentCode" VARCHAR(32) NOT NULL,
    "documentNumber" VARCHAR(16) NOT NULL,
    "studentName" VARCHAR(200) NOT NULL,
    "sessionDate" DATE NOT NULL,
    "status" "StudentAttendanceStatus" NOT NULL,
    "justificationNote" VARCHAR(500),
    "justifiedAt" TIMESTAMP(3),
    "recordedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_grades" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "groupCode" VARCHAR(16) NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "studentCode" VARCHAR(32) NOT NULL,
    "documentNumber" VARCHAR(16) NOT NULL,
    "studentName" VARCHAR(200) NOT NULL,
    "listeningReading" DECIMAL(5,2),
    "writing" DECIMAL(5,2),
    "testOne" DECIMAL(5,2),
    "participation" DECIMAL(5,2),
    "finalTest" DECIMAL(5,2),
    "recordedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_grades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_attendance_groupId_studentUserId_sessionDate_key" ON "student_attendance"("groupId", "studentUserId", "sessionDate");
CREATE INDEX "student_attendance_studentUserId_sessionDate_idx" ON "student_attendance"("studentUserId", "sessionDate");
CREATE INDEX "student_attendance_groupId_sessionDate_idx" ON "student_attendance"("groupId", "sessionDate");
CREATE UNIQUE INDEX "student_grades_groupId_studentUserId_key" ON "student_grades"("groupId", "studentUserId");
CREATE INDEX "student_grades_studentUserId_idx" ON "student_grades"("studentUserId");
