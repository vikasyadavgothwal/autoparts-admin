ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "modelYear" integer,
  ADD COLUMN IF NOT EXISTS "modelYearKey" integer NOT NULL DEFAULT 0;

ALTER TABLE "vehicles"
  DROP CONSTRAINT IF EXISTS "vehicles_brandKey_carNameKey_variantKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_brandKey_carNameKey_variantKey_modelYearKey_key"
  ON "vehicles" ("brandKey", "carNameKey", "variantKey", "modelYearKey");
