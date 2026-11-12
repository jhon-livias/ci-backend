CREATE TABLE "user_career_scopes" (
  "userId" UUID NOT NULL,
  "careerCode" VARCHAR(12) NOT NULL,
  CONSTRAINT "user_career_scopes_pkey" PRIMARY KEY ("userId", "careerCode")
);

ALTER TABLE "user_career_scopes"
  ADD CONSTRAINT "user_career_scopes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
