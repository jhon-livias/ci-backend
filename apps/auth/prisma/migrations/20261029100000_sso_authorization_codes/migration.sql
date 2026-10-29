CREATE TABLE "sso_authorization_codes" (
  "id" UUID NOT NULL,
  "codeHash" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "redirectUri" VARCHAR(2048) NOT NULL,
  "codeChallenge" VARCHAR(128) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sso_authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sso_authorization_codes_codeHash_key" ON "sso_authorization_codes"("codeHash");
CREATE INDEX "sso_authorization_codes_userId_expiresAt_idx" ON "sso_authorization_codes"("userId", "expiresAt");
CREATE INDEX "sso_authorization_codes_applicationId_expiresAt_idx" ON "sso_authorization_codes"("applicationId", "expiresAt");
CREATE INDEX "sso_authorization_codes_expiresAt_idx" ON "sso_authorization_codes"("expiresAt");

INSERT INTO "identity_applications" ("id", "code", "name", "enabled", "createdAt", "updatedAt")
VALUES ('8b8ff004-58dd-45e1-bb29-2a50c0fdc879', 'ci-tickets', 'Tickets UPRIT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "sso_authorization_codes" ADD CONSTRAINT "sso_authorization_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sso_authorization_codes" ADD CONSTRAINT "sso_authorization_codes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "identity_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
