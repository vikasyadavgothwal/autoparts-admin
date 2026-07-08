CREATE TYPE "RfqBidStatus" AS ENUM ('submitted', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

CREATE SEQUENCE "rfq_public_id_seq" START 1847;
CREATE OR REPLACE FUNCTION next_rfq_public_id() RETURNS TEXT AS $$
  SELECT 'RFQ-' || LPAD(nextval('rfq_public_id_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL VOLATILE;

CREATE SEQUENCE "order_public_id_seq" START 1001;
CREATE OR REPLACE FUNCTION next_order_public_id() RETURNS TEXT AS $$
  SELECT 'ORD-' || LPAD(nextval('order_public_id_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL VOLATILE;

ALTER TABLE "rfqs" ADD COLUMN "publicId" TEXT;
UPDATE "rfqs" SET "publicId" = next_rfq_public_id() WHERE "publicId" IS NULL;
ALTER TABLE "rfqs" ALTER COLUMN "publicId" SET DEFAULT next_rfq_public_id();
ALTER TABLE "rfqs" ALTER COLUMN "publicId" SET NOT NULL;

CREATE TABLE "rfq_bids" (
  "id" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "deliveryDays" INTEGER NOT NULL,
  "validUntil" TIMESTAMP(3),
  "notes" TEXT,
  "status" "RfqBidStatus" NOT NULL DEFAULT 'submitted',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfq_bids_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT next_order_public_id(),
  "rfqId" TEXT NOT NULL,
  "bidId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rfqs_publicId_key" ON "rfqs"("publicId");
CREATE UNIQUE INDEX "rfq_bids_rfqId_supplierId_key" ON "rfq_bids"("rfqId", "supplierId");
CREATE INDEX "rfq_bids_supplierId_status_idx" ON "rfq_bids"("supplierId", "status");
CREATE INDEX "rfq_bids_rfqId_status_idx" ON "rfq_bids"("rfqId", "status");
CREATE UNIQUE INDEX "orders_publicId_key" ON "orders"("publicId");
CREATE UNIQUE INDEX "orders_rfqId_key" ON "orders"("rfqId");
CREATE UNIQUE INDEX "orders_bidId_key" ON "orders"("bidId");
CREATE INDEX "orders_buyerId_status_idx" ON "orders"("buyerId", "status");
CREATE INDEX "orders_supplierId_status_idx" ON "orders"("supplierId", "status");

ALTER TABLE "rfq_bids" ADD CONSTRAINT "rfq_bids_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfq_bids" ADD CONSTRAINT "rfq_bids_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "rfq_bids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
