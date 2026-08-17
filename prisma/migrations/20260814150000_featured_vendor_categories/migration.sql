CREATE TABLE "featured_vendor_category_prices" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "priceAmount" INTEGER NOT NULL DEFAULT 0,
  "priceCurrency" TEXT NOT NULL DEFAULT 'AED',
  "validityDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "featured_vendor_category_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_featured_categories" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "businessAccountId" TEXT,
  "addOnRequestId" TEXT,
  "assignedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_featured_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "featured_vendor_category_prices_categoryId_key"
ON "featured_vendor_category_prices"("categoryId");

CREATE INDEX "featured_vendor_category_prices_categoryId_idx"
ON "featured_vendor_category_prices"("categoryId");

CREATE UNIQUE INDEX "supplier_featured_categories_supplierId_categoryId_source_key"
ON "supplier_featured_categories"("supplierId", "categoryId", "source");

CREATE INDEX "supplier_featured_categories_supplierId_idx"
ON "supplier_featured_categories"("supplierId");

CREATE INDEX "supplier_featured_categories_categoryId_idx"
ON "supplier_featured_categories"("categoryId");

CREATE INDEX "supplier_featured_categories_businessAccountId_idx"
ON "supplier_featured_categories"("businessAccountId");

CREATE INDEX "supplier_featured_categories_addOnRequestId_idx"
ON "supplier_featured_categories"("addOnRequestId");

ALTER TABLE "featured_vendor_category_prices"
ADD CONSTRAINT "featured_vendor_category_prices_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_featured_categories"
ADD CONSTRAINT "supplier_featured_categories_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_featured_categories"
ADD CONSTRAINT "supplier_featured_categories_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_featured_categories"
ADD CONSTRAINT "supplier_featured_categories_businessAccountId_fkey"
FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_featured_categories"
ADD CONSTRAINT "supplier_featured_categories_addOnRequestId_fkey"
FOREIGN KEY ("addOnRequestId") REFERENCES "business_add_on_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_featured_categories"
ADD CONSTRAINT "supplier_featured_categories_assignedByAdminId_fkey"
FOREIGN KEY ("assignedByAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
