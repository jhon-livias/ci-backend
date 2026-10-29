CREATE TABLE "identity_applications" (
  "id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "identity_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identity_applications_code_key" ON "identity_applications"("code");

CREATE TABLE "application_roles" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "application_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "application_roles_applicationId_code_key" ON "application_roles"("applicationId", "code");

CREATE TABLE "user_application_roles" (
  "userId" UUID NOT NULL,
  "applicationRoleId" UUID NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_application_roles_pkey" PRIMARY KEY ("userId", "applicationRoleId")
);
CREATE INDEX "user_application_roles_applicationRoleId_idx" ON "user_application_roles"("applicationRoleId");

ALTER TABLE "application_roles" ADD CONSTRAINT "application_roles_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "identity_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_application_roles" ADD CONSTRAINT "user_application_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_application_roles" ADD CONSTRAINT "user_application_roles_applicationRoleId_fkey" FOREIGN KEY ("applicationRoleId") REFERENCES "application_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
