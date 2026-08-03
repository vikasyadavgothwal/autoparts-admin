-- Clear older VIN cache rows that do not carry full decoder details.
DELETE FROM "vin_lookup_cache";

ALTER TABLE "vin_lookup_cache"
ADD COLUMN "market" TEXT,
ADD COLUMN "platform" TEXT,
ADD COLUMN "engine" TEXT,
ADD COLUMN "engineCapacity" TEXT,
ADD COLUMN "transmission" TEXT;
