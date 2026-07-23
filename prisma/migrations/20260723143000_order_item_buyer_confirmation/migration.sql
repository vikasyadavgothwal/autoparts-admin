ALTER TABLE "order_items" ADD COLUMN "buyerConfirmedAt" TIMESTAMP(3);

CREATE INDEX "order_items_buyerConfirmedAt_idx" ON "order_items"("buyerConfirmedAt");
