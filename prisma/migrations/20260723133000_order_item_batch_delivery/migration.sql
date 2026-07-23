ALTER TABLE "order_items"
  ADD COLUMN "deliveryOption" TEXT,
  ADD COLUMN "expectedDeliveryAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "proofOfDeliveryUrl" TEXT,
  ADD COLUMN "proofOfDeliveryKey" TEXT,
  ADD COLUMN "proofOfDeliveryNote" TEXT,
  ADD COLUMN "proofRecipientName" TEXT,
  ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);

UPDATE "order_items" item
SET
  "deliveredAt" = orders."proofSubmittedAt",
  "proofOfDeliveryUrl" = orders."proofOfDeliveryUrl",
  "proofOfDeliveryKey" = orders."proofOfDeliveryKey",
  "proofOfDeliveryNote" = orders."proofOfDeliveryNote",
  "proofRecipientName" = orders."proofRecipientName",
  "proofSubmittedAt" = orders."proofSubmittedAt",
  "expectedDeliveryAt" = orders."expectedDeliveryAt"
FROM "orders"
WHERE item."orderId" = orders."id"
  AND orders."proofSubmittedAt" IS NOT NULL;

CREATE INDEX "order_items_deliveredAt_idx" ON "order_items"("deliveredAt");
