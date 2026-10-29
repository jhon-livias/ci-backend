CREATE TYPE "StudentPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE "StudentPaymentConcept" AS ENUM ('ENROLLMENT', 'PROFICIENCY');

CREATE TABLE "student_payments" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "studentName" VARCHAR(200) NOT NULL,
    "concept" "StudentPaymentConcept" NOT NULL,
    "detail" VARCHAR(240) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "tariffCode" VARCHAR(32) NOT NULL,
    "status" "StudentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "correlative" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_payments_correlative_key" ON "student_payments"("correlative");
CREATE INDEX "student_payments_studentUserId_createdAt_idx" ON "student_payments"("studentUserId", "createdAt");

INSERT INTO "enrollment_tariffs" ("id", "code", "name", "amountCents", "updatedAt") VALUES
    ('a2000001-0000-4000-8000-000000000003', 'PROFICIENCY', 'Examen de suficiencia', 5000, CURRENT_TIMESTAMP);
