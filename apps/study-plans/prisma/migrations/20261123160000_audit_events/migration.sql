CREATE TABLE "study_plans"."audit_events" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "entityType" VARCHAR(20) NOT NULL,
  "entityId" UUID NOT NULL,
  "correlationId" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_events_entityType_entityId_idx" ON "study_plans"."audit_events"("entityType", "entityId");
CREATE INDEX "audit_events_actorId_createdAt_idx" ON "study_plans"."audit_events"("actorId", "createdAt");
