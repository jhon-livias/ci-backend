ALTER TABLE "user_profiles" ADD COLUMN "mobileCountry" VARCHAR(6);
ALTER TABLE "user_profiles" ADD COLUMN "mobile" VARCHAR(20);

CREATE TABLE "user_functionality_grants" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  "functionalityName" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "user_functionality_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_functionality_grants_userId_permissionId_functionalityName_key"
  ON "user_functionality_grants"("userId", "permissionId", "functionalityName");
CREATE INDEX "user_functionality_grants_userId_idx" ON "user_functionality_grants"("userId");

ALTER TABLE "user_functionality_grants"
  ADD CONSTRAINT "user_functionality_grants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
