ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "users" AS account
SET "totpRequired" = true
WHERE account."totpRequired" = false
  AND (
    EXISTS (
      SELECT 1 FROM "user_roles" AS assignment
      WHERE assignment."userId" = account."id"
        AND assignment."role" IN ('ADMINISTRATOR', 'DIRECTOR')
    )
    OR EXISTS (
      SELECT 1
      FROM "user_application_roles" AS link
      JOIN "application_roles" AS role ON role."id" = link."applicationRoleId"
      WHERE link."userId" = account."id"
        AND role."code" IN ('tickets.admin', 'tickets.area_manager', 'study-plans.faculty')
    )
  );

INSERT INTO "identity_applications" ("id", "code", "name", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'study-plans', 'Planes de estudio', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "identity_applications" WHERE "code" = 'study-plans'
);

INSERT INTO "application_roles" ("id", "applicationId", "code", "name", "enabled")
SELECT gen_random_uuid(), app."id", role.code, role.name, true
FROM "identity_applications" AS app
CROSS JOIN (
  VALUES
    ('study-plans.faculty', 'Facultad'),
    ('study-plans.teacher', 'Docente')
) AS role(code, name)
WHERE app."code" = 'study-plans'
  AND NOT EXISTS (
    SELECT 1
    FROM "application_roles" AS existing
    WHERE existing."applicationId" = app."id"
      AND existing."code" = role.code
  );
