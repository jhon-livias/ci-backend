CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'APPROVED', 'FAILED', 'WITHDRAWN');
CREATE TYPE "ProficiencyExamStatus" AS ENUM ('PENDING_PAYMENT', 'REGISTERED');

CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "groupCode" VARCHAR(16) NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "modality" VARCHAR(80) NOT NULL,
    "studyType" VARCHAR(80) NOT NULL,
    "schedule" VARCHAR(240) NOT NULL,
    "teacherName" VARCHAR(200) NOT NULL,
    "meetUrl" VARCHAR(255) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentId" UUID,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enrollments_studentUserId_groupId_key" ON "enrollments"("studentUserId", "groupId");
CREATE INDEX "enrollments_studentUserId_language_enrolledAt_idx" ON "enrollments"("studentUserId", "language", "enrolledAt");
CREATE INDEX "enrollments_groupId_status_idx" ON "enrollments"("groupId", "status");

CREATE TABLE "group_wait_requests" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "groupCode" VARCHAR(16) NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "schedule" VARCHAR(240) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_wait_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_wait_requests_studentUserId_groupId_key" ON "group_wait_requests"("studentUserId", "groupId");
CREATE INDEX "group_wait_requests_groupId_idx" ON "group_wait_requests"("groupId");

CREATE TABLE "proficiency_exam_registrations" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "examGroupId" UUID,
    "examDate" TIMESTAMP(3),
    "modality" VARCHAR(80) NOT NULL,
    "meetUrl" VARCHAR(255) NOT NULL,
    "paymentId" UUID,
    "status" "ProficiencyExamStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proficiency_exam_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proficiency_exam_registrations_studentUserId_createdAt_idx" ON "proficiency_exam_registrations"("studentUserId", "createdAt");
