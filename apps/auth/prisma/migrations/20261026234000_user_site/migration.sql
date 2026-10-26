ALTER TABLE "users" ADD COLUMN "siteId" UUID;

CREATE INDEX "users_siteId_idx" ON "users"("siteId");
