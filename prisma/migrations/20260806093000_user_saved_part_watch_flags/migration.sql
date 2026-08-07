ALTER TABLE "user_saved_parts"
ADD COLUMN IF NOT EXISTS "watchPriceChanges" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_saved_parts"
ADD COLUMN IF NOT EXISTS "watchStockReturns" BOOLEAN NOT NULL DEFAULT false;
