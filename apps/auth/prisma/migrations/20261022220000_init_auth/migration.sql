-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

CREATE TYPE "UserRoleName" AS ENUM ('STUDENT', 'TEACHER', 'ADVISOR', 'DIRECTOR', 'ADMINISTRATOR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'LOCKED');
CREATE TYPE "IdentitySource" AS ENUM ('MANUAL', 'INTRANET_SYNC', 'IMPORT');
CREATE TYPE "IdentityDocumentType" AS ENUM ('DNI', 'CE', 'PASSPORT');

CREATE TABLE "users" (
  "id" UUID NOT NULL, "username" VARCHAR(64) NOT NULL, "email" VARCHAR(254) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL, "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "source" "IdentitySource" NOT NULL DEFAULT 'MANUAL', "emailVerifiedAt" TIMESTAMP(3),
  "passwordChangedAt" TIMESTAMP(3), "lastLoginAt" TIMESTAMP(3), "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "user_profiles" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "documentType" "IdentityDocumentType" NOT NULL DEFAULT 'DNI',
  "documentNumber" VARCHAR(20) NOT NULL, "firstName" VARCHAR(100) NOT NULL,
  "paternalLastName" VARCHAR(100) NOT NULL, "maternalLastName" VARCHAR(100), "phone" VARCHAR(30),
  "avatarObjectKey" VARCHAR(512), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "user_roles" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "role" "UserRoleName" NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "refreshTokenHash" VARCHAR(255) NOT NULL,
  "userAgent" VARCHAR(512), "ipHash" VARCHAR(128), "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "tokenHash" VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");
CREATE UNIQUE INDEX "user_profiles_documentNumber_key" ON "user_profiles"("documentNumber");
CREATE INDEX "user_profiles_paternalLastName_firstName_idx" ON "user_profiles"("paternalLastName", "firstName");
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");
CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");
CREATE INDEX "auth_sessions_userId_expiresAt_idx" ON "auth_sessions"("userId", "expiresAt");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
