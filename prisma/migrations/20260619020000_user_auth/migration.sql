DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'UserRole'
  ) THEN
    CREATE TYPE "UserRole" AS ENUM ('Fleet', 'User', 'Garage', 'Supplier');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "firstName" text NOT NULL,
  "lastName" text NOT NULL,
  "phone" text,
  "avatarUrl" text,
  "companyName" text,
  "addressLine1" text,
  "addressLine2" text,
  "city" text,
  "state" text,
  "postalCode" text,
  "country" text,
  "role" "UserRole" NOT NULL DEFAULT 'User',
  "isActive" boolean NOT NULL DEFAULT true,
  "emailVerifiedAt" timestamptz,
  "lastLoginAt" timestamptz,
  "authVersion" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users" ("isActive");
