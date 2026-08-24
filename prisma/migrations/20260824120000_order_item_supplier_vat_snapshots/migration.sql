ALTER TABLE "order_items"
ADD COLUMN "supplierOriginalUnitPrice" INTEGER,
ADD COLUMN "supplierVatPercentage" INTEGER,
ADD COLUMN "supplierVatAmount" INTEGER,
ADD COLUMN "supplierVatMode" TEXT;
