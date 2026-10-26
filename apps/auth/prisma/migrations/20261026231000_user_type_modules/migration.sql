CREATE TABLE "user_type_modules" (
  "id" UUID NOT NULL,
  "userTypeId" UUID NOT NULL,
  "moduleCode" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL,
  CONSTRAINT "user_type_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_type_modules_userTypeId_moduleCode_key" ON "user_type_modules"("userTypeId", "moduleCode");
CREATE UNIQUE INDEX "user_type_modules_userTypeId_position_key" ON "user_type_modules"("userTypeId", "position");

ALTER TABLE "user_type_modules"
  ADD CONSTRAINT "user_type_modules_userTypeId_fkey"
  FOREIGN KEY ("userTypeId") REFERENCES "user_type_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_type_modules" ("id", "userTypeId", "moduleCode", "enabled", "position")
SELECT gen_random_uuid(), "id", "moduleCode", true, 0
FROM "user_type_definitions"
WHERE "deletedAt" IS NULL;
