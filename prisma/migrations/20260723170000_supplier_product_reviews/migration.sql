CREATE TABLE "supplier_product_reviews" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "supplierPartId" TEXT NOT NULL,
  "partUid" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_product_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_product_reviews_orderItemId_key" ON "supplier_product_reviews"("orderItemId");
CREATE UNIQUE INDEX "supplier_product_reviews_customerId_supplierId_partUid_key" ON "supplier_product_reviews"("customerId", "supplierId", "partUid");
CREATE INDEX "supplier_product_reviews_supplierId_createdAt_idx" ON "supplier_product_reviews"("supplierId", "createdAt");
CREATE INDEX "supplier_product_reviews_partUid_createdAt_idx" ON "supplier_product_reviews"("partUid", "createdAt");
CREATE INDEX "supplier_product_reviews_supplierPartId_createdAt_idx" ON "supplier_product_reviews"("supplierPartId", "createdAt");
CREATE INDEX "supplier_product_reviews_customerId_createdAt_idx" ON "supplier_product_reviews"("customerId", "createdAt");

ALTER TABLE "supplier_product_reviews" ADD CONSTRAINT "supplier_product_reviews_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_product_reviews" ADD CONSTRAINT "supplier_product_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_product_reviews" ADD CONSTRAINT "supplier_product_reviews_supplierPartId_fkey" FOREIGN KEY ("supplierPartId") REFERENCES "supplier_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_product_reviews" ADD CONSTRAINT "supplier_product_reviews_partUid_fkey" FOREIGN KEY ("partUid") REFERENCES "part_master"("partUid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_product_reviews" ADD CONSTRAINT "supplier_product_reviews_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
