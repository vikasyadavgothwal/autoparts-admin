ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "roleIds" text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE "role"
  ADD COLUMN IF NOT EXISTS "permissionIds" text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF to_regclass('public.admin_roles') IS NOT NULL THEN
    UPDATE "admin" AS a
    SET "roleIds" = assignments."roleIds"
    FROM (
      SELECT
        "adminId",
        array_agg(DISTINCT "roleId" ORDER BY "roleId") AS "roleIds"
      FROM "admin_roles"
      GROUP BY "adminId"
    ) AS assignments
    WHERE a."id" = assignments."adminId";
  END IF;

  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    UPDATE "role" AS r
    SET "permissionIds" = assignments."permissionIds"
    FROM (
      SELECT
        "roleId",
        array_agg(DISTINCT "permissionId" ORDER BY "permissionId") AS "permissionIds"
      FROM "role_permissions"
      GROUP BY "roleId"
    ) AS assignments
    WHERE r."id" = assignments."roleId";
  END IF;
END
$$;

DROP TABLE IF EXISTS "admin_roles";
DROP TABLE IF EXISTS "role_permissions";
