CREATE TABLE "rfq_bid_items" (
  "id" TEXT NOT NULL,
  "bidId" TEXT NOT NULL,
  "rfqPartId" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "lineTotal" INTEGER NOT NULL,
  "partType" TEXT NOT NULL DEFAULT 'New',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfq_bid_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rfq_bid_items_bidId_rfqPartId_key" ON "rfq_bid_items"("bidId", "rfqPartId");
CREATE INDEX "rfq_bid_items_rfqPartId_idx" ON "rfq_bid_items"("rfqPartId");

ALTER TABLE "rfq_bid_items" ADD CONSTRAINT "rfq_bid_items_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "rfq_bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfq_bid_items" ADD CONSTRAINT "rfq_bid_items_rfqPartId_fkey" FOREIGN KEY ("rfqPartId") REFERENCES "rfq_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
