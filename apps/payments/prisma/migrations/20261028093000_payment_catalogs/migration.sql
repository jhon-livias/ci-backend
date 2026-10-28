CREATE TYPE "PaymentIncidentStatus" AS ENUM ('PENDING', 'RESOLVED');

CREATE TABLE "enrollment_tariffs" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_tariffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enrollment_tariffs_code_key" ON "enrollment_tariffs"("code");

CREATE TABLE "payment_incidents" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "studentName" VARCHAR(200) NOT NULL,
    "concept" VARCHAR(120) NOT NULL,
    "error" VARCHAR(160) NOT NULL,
    "status" "PaymentIncidentStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "payment_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_incidents_status_occurredAt_idx" ON "payment_incidents"("status", "occurredAt");

INSERT INTO "enrollment_tariffs" ("id", "code", "name", "amountCents", "updatedAt") VALUES
    ('a2000001-0000-4000-8000-000000000001', 'REGULAR', 'Matrícula - Regular', 23000, CURRENT_TIMESTAMP),
    ('a2000001-0000-4000-8000-000000000002', 'INTENSIVE', 'Matrícula - Intensivo', 45000, CURRENT_TIMESTAMP);
