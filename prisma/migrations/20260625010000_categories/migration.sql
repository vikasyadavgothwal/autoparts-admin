DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CategoryStatus') THEN
    CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "categories" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "parts"
  ADD COLUMN IF NOT EXISTS "categoryId" text;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key"
  ON "categories" ("slug");

CREATE INDEX IF NOT EXISTS "categories_status_idx"
  ON "categories" ("status");

CREATE INDEX IF NOT EXISTS "parts_categoryId_idx"
  ON "parts" ("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parts_categoryId_fkey'
  ) THEN
    ALTER TABLE "parts"
      ADD CONSTRAINT "parts_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
