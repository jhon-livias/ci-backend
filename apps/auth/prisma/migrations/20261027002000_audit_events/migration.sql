CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorName" VARCHAR(200) NOT NULL,
    "actorRole" VARCHAR(32) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "action" VARCHAR(240) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_occurredAt_idx" ON "audit_events"("occurredAt");

CREATE INDEX "audit_events_actorRole_idx" ON "audit_events"("actorRole");

CREATE INDEX "audit_events_module_idx" ON "audit_events"("module");

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
