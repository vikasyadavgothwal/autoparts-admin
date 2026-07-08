ALTER TABLE "supplier_parts"
ADD COLUMN "vendorSku" TEXT,
ADD COLUMN "oemSupersessionNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "competitorPartNumber" TEXT,
ADD COLUMN "competitorBrandName" TEXT,
ADD COLUMN "hsCode" TEXT,
ADD COLUMN "supplierImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "supplier_parts_supplierId_vendorSku_key"
ON "supplier_parts"("supplierId", "vendorSku");
