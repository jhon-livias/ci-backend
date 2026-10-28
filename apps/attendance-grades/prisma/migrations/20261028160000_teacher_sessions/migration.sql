CREATE TYPE "SessionClassKind" AS ENUM ('SYNCHRONOUS', 'ASYNCHRONOUS');

CREATE TABLE "teacher_sessions" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "teacherUserId" UUID NOT NULL,
    "groupCode" VARCHAR(16) NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "sessionDate" DATE NOT NULL,
    "classKind" "SessionClassKind" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_sessions_groupId_teacherUserId_sessionDate_key" ON "teacher_sessions"("groupId", "teacherUserId", "sessionDate");
CREATE INDEX "teacher_sessions_teacherUserId_sessionDate_idx" ON "teacher_sessions"("teacherUserId", "sessionDate");
