INSERT INTO "identity_applications" ("id", "code", "name", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'ci-tickets', 'Sistema de Tickets', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "identity_applications" WHERE "code" = 'ci-tickets'
);

INSERT INTO "application_roles" ("id", "applicationId", "code", "name", "enabled")
SELECT gen_random_uuid(), app."id", role.code, role.name, true
FROM "identity_applications" AS app
CROSS JOIN (
  VALUES
    ('tickets.admin', 'Administrador'),
    ('tickets.area_manager', 'Responsable de área'),
    ('tickets.assistant', 'Asistente'),
    ('tickets.requester', 'Solicitante')
) AS role(code, name)
WHERE app."code" = 'ci-tickets'
  AND NOT EXISTS (
    SELECT 1
    FROM "application_roles" AS existing
    WHERE existing."applicationId" = app."id"
      AND existing."code" = role.code
  );
