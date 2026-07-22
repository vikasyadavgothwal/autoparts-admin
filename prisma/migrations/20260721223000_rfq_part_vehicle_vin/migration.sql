ALTER TABLE "rfq_parts" ADD COLUMN "vehicleVin" TEXT;

UPDATE "rfq_parts" AS part
SET "vehicleVin" = rfq."vehicleVin"
FROM "rfqs" AS rfq
WHERE part."rfqId" = rfq."id";

CREATE INDEX "rfq_parts_vehicleVin_idx" ON "rfq_parts"("vehicleVin");
