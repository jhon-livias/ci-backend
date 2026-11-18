CREATE TYPE "MembershipKind" AS ENUM ('MANAGER', 'COLLABORATOR');

ALTER TABLE "team_members" ADD COLUMN "userId" UUID;
CREATE UNIQUE INDEX "team_members_userId_key" ON "team_members"("userId");

CREATE TABLE "area_memberships" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "areaId" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "document" VARCHAR(12) NOT NULL,
  "phone" VARCHAR(20) NOT NULL DEFAULT '',
  "roleTitle" VARCHAR(160) NOT NULL DEFAULT '',
  "kind" "MembershipKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "area_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "area_memberships_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "area_memberships_userId_areaId_key" ON "area_memberships"("userId", "areaId");
CREATE INDEX "area_memberships_areaId_idx" ON "area_memberships"("areaId");
