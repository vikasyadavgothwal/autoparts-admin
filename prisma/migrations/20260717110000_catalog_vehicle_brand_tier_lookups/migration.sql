CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tier_lookups" (
    "id" TEXT NOT NULL,
    "customerFacingLabel" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tier_lookups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_lookups" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_lookups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_lookups" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "tierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_lookups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_lookup_categories" (
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "brand_lookup_categories_pkey" PRIMARY KEY ("brandId", "categoryId")
);

CREATE INDEX "product_categories_parentId_idx" ON "product_categories"("parentId");
CREATE INDEX "product_categories_name_idx" ON "product_categories"("name");
CREATE UNIQUE INDEX "tier_lookups_customerFacingLabel_key" ON "tier_lookups"("customerFacingLabel");
CREATE INDEX "vehicle_lookups_make_model_idx" ON "vehicle_lookups"("make", "model");
CREATE INDEX "vehicle_lookups_tierId_idx" ON "vehicle_lookups"("tierId");
CREATE UNIQUE INDEX "brand_lookups_brandName_key" ON "brand_lookups"("brandName");
CREATE INDEX "brand_lookups_tierId_idx" ON "brand_lookups"("tierId");
CREATE INDEX "brand_lookup_categories_categoryId_idx" ON "brand_lookup_categories"("categoryId");

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "product_categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicle_lookups"
ADD CONSTRAINT "vehicle_lookups_tierId_fkey"
FOREIGN KEY ("tierId") REFERENCES "tier_lookups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "brand_lookups"
ADD CONSTRAINT "brand_lookups_tierId_fkey"
FOREIGN KEY ("tierId") REFERENCES "tier_lookups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "brand_lookup_categories"
ADD CONSTRAINT "brand_lookup_categories_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "brand_lookups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_lookup_categories"
ADD CONSTRAINT "brand_lookup_categories_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
