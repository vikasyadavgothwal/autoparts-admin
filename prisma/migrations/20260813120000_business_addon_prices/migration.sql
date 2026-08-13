CREATE TABLE "business_add_on_prices" (
  "id" TEXT NOT NULL,
  "accountType" "BusinessAccountType" NOT NULL,
  "featureKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "pricingModel" TEXT NOT NULL DEFAULT 'fixed',
  "priceAmount" INTEGER NOT NULL DEFAULT 0,
  "priceCurrency" TEXT NOT NULL DEFAULT 'AED',
  "validityDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_add_on_prices_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "business_add_on_requests"
ADD COLUMN "priceAmount" INTEGER,
ADD COLUMN "priceCurrency" TEXT,
ADD COLUMN "priceQuantity" INTEGER,
ADD COLUMN "unitPriceAmount" INTEGER;

CREATE UNIQUE INDEX "business_add_on_prices_accountType_featureKey_key"
ON "business_add_on_prices"("accountType", "featureKey");

CREATE INDEX "business_add_on_prices_accountType_idx"
ON "business_add_on_prices"("accountType");
