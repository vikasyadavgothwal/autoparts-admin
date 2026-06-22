ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "roles" "UserRole"[] NOT NULL
    DEFAULT ARRAY['User']::"UserRole"[],
  ADD COLUMN IF NOT EXISTS "activeRole" "UserRole" NOT NULL DEFAULT 'User';

UPDATE "users"
SET
  "roles" = ARRAY["role"]::"UserRole"[],
  "activeRole" = "role"
WHERE "role" IS NOT NULL;

DROP INDEX IF EXISTS "users_role_idx";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "role";

CREATE INDEX IF NOT EXISTS "users_roles_idx"
  ON "users" USING GIN ("roles");

CREATE INDEX IF NOT EXISTS "users_activeRole_idx"
  ON "users" ("activeRole");
