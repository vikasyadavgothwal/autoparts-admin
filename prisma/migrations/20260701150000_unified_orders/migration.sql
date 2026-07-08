CREATE TYPE "OrderSource" AS ENUM ('rfq', 'direct');

ALTER TABLE "orders" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'rfq';
ALTER TABLE "orders" ALTER COLUMN "rfqId" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "bidId" DROP NOT NULL;

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "supplierPartId" TEXT,
  "partName" TEXT NOT NULL,
  "partNumber" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER,
  "lineTotal" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

INSERT INTO "order_items" (
  "id", "orderId", "partName", "partNumber", "quantity", "createdAt", "updatedAt"
)
SELECT
  'backfill_' || md5(o."id" || p."id"),
  o."id",
  p."partName",
  p."partNumber",
  p."quantity",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "orders" o
JOIN "rfq_parts" p ON p."rfqId" = o."rfqId"
WHERE NOT EXISTS (SELECT 1 FROM "order_items" i WHERE i."orderId" = o."id");

CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_supplierPartId_idx" ON "order_items"("supplierPartId");
CREATE INDEX "order_items_partNumber_idx" ON "order_items"("partNumber");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_supplierPartId_fkey" FOREIGN KEY ("supplierPartId") REFERENCES "supplier_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
