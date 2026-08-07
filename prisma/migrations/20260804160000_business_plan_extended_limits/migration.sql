ALTER TABLE "business_plans"
ADD COLUMN "brandLimit" INTEGER,
ADD COLUMN "categoryLimit" INTEGER,
ADD COLUMN "rfqLimit" INTEGER,
ADD COLUMN "orderLimit" INTEGER,
ADD COLUMN "serviceLimit" INTEGER,
ADD COLUMN "savedSearchLimit" INTEGER,
ADD COLUMN "wishlistLimit" INTEGER,
ADD COLUMN "featuredVendor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "searchBoostLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "apiAccessLevel" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "integrationLimit" INTEGER,
ADD COLUMN "approvalWorkflowEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "customRolesEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "business_plans"
SET
  "rfqLimit" = 3,
  "orderLimit" = 3,
  "savedSearchLimit" = 2,
  "wishlistLimit" = 10,
  "integrationLimit" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Fleet' AND "code" = 'Free';

UPDATE "business_plans"
SET
  "rfqLimit" = 100,
  "orderLimit" = 100,
  "savedSearchLimit" = 25,
  "wishlistLimit" = 200,
  "integrationLimit" = 2,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "apiAccessLevel" = 'standard',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Fleet' AND "code" = 'Pro';

UPDATE "business_plans"
SET
  "rfqLimit" = NULL,
  "orderLimit" = NULL,
  "savedSearchLimit" = NULL,
  "wishlistLimit" = NULL,
  "integrationLimit" = NULL,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "apiAccessLevel" = 'enterprise',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Fleet' AND "code" = 'Enterprise';

UPDATE "business_plans"
SET
  "serviceLimit" = 3,
  "orderLimit" = 5,
  "savedSearchLimit" = 2,
  "integrationLimit" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Garage' AND "code" = 'Free';

UPDATE "business_plans"
SET
  "serviceLimit" = 25,
  "orderLimit" = 100,
  "savedSearchLimit" = 25,
  "integrationLimit" = 2,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "apiAccessLevel" = 'standard',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Garage' AND "code" = 'Pro';

UPDATE "business_plans"
SET
  "serviceLimit" = NULL,
  "orderLimit" = NULL,
  "savedSearchLimit" = NULL,
  "integrationLimit" = NULL,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "apiAccessLevel" = 'enterprise',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Garage' AND "code" = 'Enterprise';

UPDATE "business_plans"
SET
  "brandLimit" = 3,
  "categoryLimit" = 3,
  "rfqLimit" = 10,
  "orderLimit" = 10,
  "savedSearchLimit" = 2,
  "wishlistLimit" = 10,
  "integrationLimit" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Supplier' AND "code" = 'Free';

UPDATE "business_plans"
SET
  "brandLimit" = 25,
  "categoryLimit" = 25,
  "rfqLimit" = 200,
  "orderLimit" = 200,
  "savedSearchLimit" = 25,
  "wishlistLimit" = 200,
  "featuredVendor" = true,
  "searchBoostLevel" = 1,
  "apiAccessLevel" = 'standard',
  "integrationLimit" = 2,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Supplier' AND "code" = 'Pro';

UPDATE "business_plans"
SET
  "brandLimit" = NULL,
  "categoryLimit" = NULL,
  "rfqLimit" = NULL,
  "orderLimit" = NULL,
  "savedSearchLimit" = NULL,
  "wishlistLimit" = NULL,
  "featuredVendor" = true,
  "searchBoostLevel" = 2,
  "apiAccessLevel" = 'enterprise',
  "integrationLimit" = NULL,
  "approvalWorkflowEnabled" = true,
  "customRolesEnabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "accountType" = 'Supplier' AND "code" = 'Enterprise';
