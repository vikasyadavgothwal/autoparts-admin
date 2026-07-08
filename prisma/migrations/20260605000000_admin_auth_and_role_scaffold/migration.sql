CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "passwordHash" text NOT NULL DEFAULT '';

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "roleIds" text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "failedLoginCount" integer NOT NULL DEFAULT 0;

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "lockedUntil" timestamptz;

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT NOW();

ALTER TABLE "admin"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW();

CREATE TABLE "role" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "permissionIds" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "isSystem" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE "permission" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE "admin_sessions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adminId" text NOT NULL,
  "refreshTokenHash" text NOT NULL UNIQUE,
  "accessJti" text NOT NULL,
  "deviceHash" text NOT NULL,
  "ipHash" text NOT NULL,
  "userAgent" text,
  "familyTokenId" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "replacedBy" text,
  "lastUsedAt" timestamptz NOT NULL DEFAULT NOW(),
  "rotationCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "admin_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"("id") ON DELETE CASCADE
);

CREATE INDEX "admin_sessions_adminId_idx" ON "admin_sessions" ("adminId");
CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions" ("expiresAt");
