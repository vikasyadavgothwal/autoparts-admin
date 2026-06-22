ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "googleId" text,
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ALTER COLUMN "firstName" DROP NOT NULL,
  ALTER COLUMN "lastName" DROP NOT NULL,
  ALTER COLUMN "authVersion" SET DEFAULT 1;

UPDATE "users"
SET "authVersion" = 1
WHERE "authVersion" < 1;

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key"
  ON "users" ("phone");

CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key"
  ON "users" ("googleId");

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "refreshTokenHash" text NOT NULL UNIQUE,
  "accessJti" text NOT NULL,
  "deviceName" text,
  "userAgent" text,
  "ipHash" text,
  "lastUsedAt" timestamptz,
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_sessions_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_sessions_userId_idx"
  ON "user_sessions" ("userId");

CREATE INDEX IF NOT EXISTS "user_sessions_expiresAt_idx"
  ON "user_sessions" ("expiresAt");
