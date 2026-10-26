CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "teacher_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "teacherCode" VARCHAR(32),
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teacher_profiles_userId_key" ON "teacher_profiles"("userId");
CREATE UNIQUE INDEX "teacher_profiles_teacherCode_key" ON "teacher_profiles"("teacherCode");
CREATE INDEX "teacher_profiles_status_idx" ON "teacher_profiles"("status");

CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE INDEX "sites_active_deletedAt_idx" ON "sites"("active", "deletedAt");

INSERT INTO "sites" ("id", "code", "name", "active", "updatedAt")
VALUES ('c7fe9de9-0291-4762-8f22-fb7faf824f9e', 'TRUJILLO', 'Trujillo', true, CURRENT_TIMESTAMP);
