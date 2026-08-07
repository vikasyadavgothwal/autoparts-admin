ALTER TABLE "business_plans"
ADD COLUMN "yearlyPriceAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "business_plans"
SET "yearlyPriceAmount" = CASE
  WHEN "priceAmount" > 0 THEN ("priceAmount" * 80) / 100
  ELSE 0
END;
