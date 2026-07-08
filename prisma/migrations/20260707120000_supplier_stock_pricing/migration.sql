CREATE TABLE IF NOT EXISTS "supplier_part_stock" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierPartId" TEXT NOT NULL,
  "vendorSku" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "leadTime" TEXT,
  "lowStockThreshold" INTEGER,
  "rawUploadData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_part_stock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_part_pricing" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierPartId" TEXT NOT NULL,
  "vendorSku" TEXT NOT NULL,
  "basePrice" INTEGER,
  "discountPrice" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "taxClass" TEXT,
  "vat" TEXT,
  "maxRetailPrice" INTEGER,
  "wholesaleDistributorPrice" INTEGER,
  "fleetPrice" INTEGER,
  "rawUploadData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_part_pricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_part_stock_supplierId_vendorSku_warehouseId_key"
  ON "supplier_part_stock"("supplierId", "vendorSku", "warehouseId");
CREATE INDEX IF NOT EXISTS "supplier_part_stock_supplierId_idx"
  ON "supplier_part_stock"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_part_stock_supplierPartId_idx"
  ON "supplier_part_stock"("supplierPartId");
CREATE INDEX IF NOT EXISTS "supplier_part_stock_vendorSku_idx"
  ON "supplier_part_stock"("vendorSku");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_part_pricing_supplierPartId_key"
  ON "supplier_part_pricing"("supplierPartId");
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_part_pricing_supplierId_vendorSku_key"
  ON "supplier_part_pricing"("supplierId", "vendorSku");
CREATE INDEX IF NOT EXISTS "supplier_part_pricing_supplierId_idx"
  ON "supplier_part_pricing"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_part_pricing_vendorSku_idx"
  ON "supplier_part_pricing"("vendorSku");

ALTER TABLE "supplier_part_stock"
  ADD CONSTRAINT "supplier_part_stock_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_part_stock"
  ADD CONSTRAINT "supplier_part_stock_supplierPartId_fkey"
  FOREIGN KEY ("supplierPartId") REFERENCES "supplier_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_part_pricing"
  ADD CONSTRAINT "supplier_part_pricing_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_part_pricing"
  ADD CONSTRAINT "supplier_part_pricing_supplierPartId_fkey"
  FOREIGN KEY ("supplierPartId") REFERENCES "supplier_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
