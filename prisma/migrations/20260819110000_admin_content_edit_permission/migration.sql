INSERT INTO "permission" ("id", "code", "name", "description", "createdAt")
VALUES (
  'system-admin-content-edit',
  'CONTENT_EDIT',
  'Edit public content',
  'Publish public pages, legal content, and related images.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "description" = EXCLUDED."description";

INSERT INTO "role" ("id", "code", "name", "description", "permissionIds", "isSystem", "createdAt", "updatedAt")
VALUES (
  'system-admin-content-editor',
  'ADMIN_CONTENT_EDITOR',
  'Admin Content Editor',
  'Can publish public pages, legal content, and related images.',
  ARRAY['system-admin-content-edit'],
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "permissionIds" = ARRAY['system-admin-content-edit'],
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "isSystem" = TRUE,
    "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "admin"
SET "roleIds" = array_append(
  "roleIds",
  (SELECT "id" FROM "role" WHERE "code" = 'ADMIN_CONTENT_EDITOR')
)
WHERE "isActive" = TRUE
  AND NOT (
    (SELECT "id" FROM "role" WHERE "code" = 'ADMIN_CONTENT_EDITOR') = ANY("roleIds")
  );
