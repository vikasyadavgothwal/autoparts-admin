CREATE TABLE "plan_featured_vendor_categories" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_featured_vendor_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_featured_vendor_categories_planId_categoryId_key"
  ON "plan_featured_vendor_categories"("planId", "categoryId");

CREATE INDEX "plan_featured_vendor_categories_planId_idx"
  ON "plan_featured_vendor_categories"("planId");

CREATE INDEX "plan_featured_vendor_categories_categoryId_idx"
  ON "plan_featured_vendor_categories"("categoryId");

ALTER TABLE "plan_featured_vendor_categories"
  ADD CONSTRAINT "plan_featured_vendor_categories_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "business_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plan_featured_vendor_categories"
  ADD CONSTRAINT "plan_featured_vendor_categories_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
