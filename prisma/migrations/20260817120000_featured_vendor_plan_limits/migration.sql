ALTER TABLE "business_plans"
  ADD COLUMN "featuredVendorCategoryLimit" INTEGER,
  ADD COLUMN "featuredVendorValidityDays" INTEGER;

ALTER TABLE "supplier_featured_categories"
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "validUntil" TIMESTAMP(3);
