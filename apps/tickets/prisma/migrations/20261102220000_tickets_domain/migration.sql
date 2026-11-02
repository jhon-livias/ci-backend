DROP TABLE IF EXISTS "ticket_history" CASCADE;
DROP TABLE IF EXISTS "ticket_comments" CASCADE;
DROP TABLE IF EXISTS "tickets" CASCADE;
DROP TABLE IF EXISTS "ticket_categories" CASCADE;
DROP TABLE IF EXISTS "areas" CASCADE;
DROP TYPE IF EXISTS "TicketStatus";
DROP TYPE IF EXISTS "TicketPriority";

CREATE TYPE "TicketStatus" AS ENUM ('CREATED', 'IN_REVIEW', 'RETURNED', 'RESOLVED', 'DERIVED', 'REOPENED');
CREATE TYPE "TicketKind" AS ENUM ('EXTERNAL', 'INTERNAL');
CREATE TYPE "TicketPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "TicketAbout" AS ENUM ('SELF', 'STUDENT', 'TEACHER');

CREATE TABLE "areas" (
  "id" UUID NOT NULL,
  "parentId" UUID,
  "code" VARCHAR(6) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "responsibility" VARCHAR(400) NOT NULL,
  "managerName" VARCHAR(160) NOT NULL,
  "managerDocument" VARCHAR(12) NOT NULL,
  "managerEmail" VARCHAR(254) NOT NULL,
  "receivesTickets" BOOLEAN NOT NULL DEFAULT false,
  "allowsInternal" BOOLEAN NOT NULL DEFAULT false,
  "canCreateTickets" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "areas_code_key" ON "areas"("code");
CREATE INDEX "areas_parentId_idx" ON "areas"("parentId");
ALTER TABLE "areas" ADD CONSTRAINT "areas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ticket_categories" (
  "id" UUID NOT NULL,
  "areaId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(400) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_categories_areaId_idx" ON "ticket_categories"("areaId");
CREATE UNIQUE INDEX "ticket_categories_areaId_name_key" ON "ticket_categories"("areaId", "name");
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "team_members" (
  "id" UUID NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "document" VARCHAR(12) NOT NULL,
  "roleTitle" VARCHAR(160) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "functions" VARCHAR(400) NOT NULL,
  "schedule" VARCHAR(200) NOT NULL,
  "isManager" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_members_document_key" ON "team_members"("document");

CREATE TABLE "priority_levels" (
  "level" "TicketPriority" NOT NULL,
  "description" VARCHAR(400) NOT NULL,
  CONSTRAINT "priority_levels_pkey" PRIMARY KEY ("level")
);

CREATE TABLE "priority_activities" (
  "id" UUID NOT NULL,
  "level" "TicketPriority" NOT NULL,
  "categoryName" VARCHAR(160) NOT NULL,
  "activity" VARCHAR(240) NOT NULL,
  "estimate" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "priority_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "priority_activities_level_idx" ON "priority_activities"("level");
ALTER TABLE "priority_activities" ADD CONSTRAINT "priority_activities_level_fkey" FOREIGN KEY ("level") REFERENCES "priority_levels"("level") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ticket_sequences" (
  "prefix" VARCHAR(16) NOT NULL,
  "nextValue" INTEGER NOT NULL,
  CONSTRAINT "ticket_sequences_pkey" PRIMARY KEY ("prefix")
);

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "kind" "TicketKind" NOT NULL,
  "requesterUserId" UUID NOT NULL,
  "requesterName" VARCHAR(160) NOT NULL,
  "requesterRole" VARCHAR(80) NOT NULL,
  "academicArea" VARCHAR(80) NOT NULL DEFAULT '',
  "about" "TicketAbout" NOT NULL DEFAULT 'SELF',
  "aboutLabel" VARCHAR(200) NOT NULL,
  "areaId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "categoryName" VARCHAR(160) NOT NULL,
  "destinationAreaCode" VARCHAR(6) NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'CREATED',
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "estimate" VARCHAR(80) NOT NULL,
  "assignedMemberId" UUID,
  "assignedName" VARCHAR(160),
  "dueOn" DATE,
  "description" VARCHAR(4000) NOT NULL,
  "receiverResponse" VARCHAR(4000) NOT NULL DEFAULT '',
  "emittedInternally" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");
CREATE INDEX "tickets_requesterUserId_createdAt_idx" ON "tickets"("requesterUserId", "createdAt");
CREATE INDEX "tickets_assignedMemberId_status_idx" ON "tickets"("assignedMemberId", "status");
CREATE INDEX "tickets_areaId_status_idx" ON "tickets"("areaId", "status");
CREATE INDEX "tickets_kind_status_idx" ON "tickets"("kind", "status");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ticket_history" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "status" "TicketStatus" NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorName" VARCHAR(160) NOT NULL,
  "actorArea" VARCHAR(80) NOT NULL,
  "fromName" VARCHAR(160),
  "toName" VARCHAR(160),
  "note" VARCHAR(4000),
  CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_history_ticketId_at_idx" ON "ticket_history"("ticketId", "at");
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ticket_attachments" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "fileName" VARCHAR(200) NOT NULL,
  CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_attachments_ticketId_idx" ON "ticket_attachments"("ticketId");
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
