DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierPartMappingStatus'
  ) THEN
    CREATE TYPE "SupplierPartMappingStatus" AS ENUM (
      'uploaded',
      'processing',
      'mapped',
      'pending_review',
      'failed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierPartMappingSource'
  ) THEN
    CREATE TYPE "SupplierPartMappingSource" AS ENUM (
      'local_db',
      '17vin',
      'manual'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PartNumberType'
  ) THEN
    CREATE TYPE "PartNumberType" AS ENUM (
      'mpn',
      'oem',
      'brand_part_number',
      'unknown'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "part_master" (
  "id" text PRIMARY KEY,
  "partUid" text NOT NULL UNIQUE,
  "source" text NOT NULL,
  "sourcePartId" text,
  "partNumber" text,
  "normalizedPartNumber" text,
  "partNumberOriginal" text,
  "brandName" text,
  "partName" text,
  "category" text,
  "groupId" text,
  "groupName" text,
  "imageUrl" text,
  "raw17VinPartInfo" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "supplier_parts" (
  "id" text PRIMARY KEY,
  "supplierId" text NOT NULL,
  "partUid" text,
  "originalPartName" text NOT NULL,
  "originalBrand" text,
  "originalMpn" text,
  "originalOemNumber" text,
  "normalizedMpn" text,
  "normalizedOemNumber" text,
  "price" integer NOT NULL,
  "stock" integer NOT NULL,
  "currency" text,
  "category" text,
  "mappingStatus" "SupplierPartMappingStatus" NOT NULL DEFAULT 'uploaded',
  "mappingSource" "SupplierPartMappingSource",
  "mappingError" text,
  "rawUploadData" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplier_parts_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_parts_partUid_fkey"
    FOREIGN KEY ("partUid") REFERENCES "part_master"("partUid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "part_number_index" (
  "id" text PRIMARY KEY,
  "partUid" text NOT NULL,
  "numberOriginal" text NOT NULL,
  "numberNormalized" text NOT NULL,
  "numberType" "PartNumberType" NOT NULL,
  "brand" text,
  "source" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "part_number_index_partUid_fkey"
    FOREIGN KEY ("partUid") REFERENCES "part_master"("partUid") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "part_number_index_partUid_numberNormalized_numberType_key"
    UNIQUE ("partUid", "numberNormalized", "numberType")
);

CREATE TABLE IF NOT EXISTS "master_fitment" (
  "id" text PRIMARY KEY,
  "partUid" text NOT NULL,
  "source" text NOT NULL,
  "vin17ModelId" text,
  "brand" text,
  "make" text,
  "model" text,
  "series" text,
  "modelYear" integer,
  "yearFrom" integer,
  "yearTo" integer,
  "engine" text,
  "engineNo" text,
  "cc" text,
  "fuelType" text,
  "transmission" text,
  "bodyType" text,
  "dateBegin" text,
  "dateEnd" text,
  "raw17VinVehicle" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "master_fitment_partUid_fkey"
    FOREIGN KEY ("partUid") REFERENCES "part_master"("partUid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "unmatched_part_search_logs" (
  "id" text PRIMARY KEY,
  "searchedNumber" text NOT NULL,
  "normalizedNumber" text NOT NULL,
  "userId" text,
  "resultStatus" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_fitment_partUid_vin17ModelId_key"
  ON "master_fitment" ("partUid", "vin17ModelId")
  WHERE "vin17ModelId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "part_master_normalizedPartNumber_idx"
  ON "part_master" ("normalizedPartNumber");
CREATE INDEX IF NOT EXISTS "part_master_normalizedPartNumber_groupId_idx"
  ON "part_master" ("normalizedPartNumber", "groupId");
CREATE INDEX IF NOT EXISTS "part_master_groupId_idx"
  ON "part_master" ("groupId");

CREATE INDEX IF NOT EXISTS "supplier_parts_supplierId_idx"
  ON "supplier_parts" ("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_parts_partUid_idx"
  ON "supplier_parts" ("partUid");
CREATE INDEX IF NOT EXISTS "supplier_parts_mappingStatus_idx"
  ON "supplier_parts" ("mappingStatus");
CREATE INDEX IF NOT EXISTS "supplier_parts_normalizedMpn_idx"
  ON "supplier_parts" ("normalizedMpn");
CREATE INDEX IF NOT EXISTS "supplier_parts_normalizedOemNumber_idx"
  ON "supplier_parts" ("normalizedOemNumber");

CREATE INDEX IF NOT EXISTS "part_number_index_numberNormalized_idx"
  ON "part_number_index" ("numberNormalized");
CREATE INDEX IF NOT EXISTS "part_number_index_numberNormalized_brand_idx"
  ON "part_number_index" ("numberNormalized", "brand");
CREATE INDEX IF NOT EXISTS "part_number_index_partUid_idx"
  ON "part_number_index" ("partUid");

CREATE INDEX IF NOT EXISTS "master_fitment_partUid_idx"
  ON "master_fitment" ("partUid");
CREATE INDEX IF NOT EXISTS "master_fitment_make_model_modelYear_idx"
  ON "master_fitment" ("make", "model", "modelYear");
CREATE INDEX IF NOT EXISTS "master_fitment_brand_model_modelYear_idx"
  ON "master_fitment" ("brand", "model", "modelYear");
CREATE INDEX IF NOT EXISTS "master_fitment_engineNo_idx"
  ON "master_fitment" ("engineNo");

CREATE INDEX IF NOT EXISTS "unmatched_part_search_logs_normalizedNumber_idx"
  ON "unmatched_part_search_logs" ("normalizedNumber");
CREATE INDEX IF NOT EXISTS "unmatched_part_search_logs_userId_idx"
  ON "unmatched_part_search_logs" ("userId");
