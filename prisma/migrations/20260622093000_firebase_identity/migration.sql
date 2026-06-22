ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "firebaseUid" text;

CREATE UNIQUE INDEX IF NOT EXISTS "users_firebaseUid_key"
  ON "users" ("firebaseUid");
