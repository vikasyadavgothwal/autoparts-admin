CREATE TYPE "SupplierApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE SEQUENCE IF NOT EXISTS user_public_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_public_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS garage_public_id_seq START 1;

CREATE OR REPLACE FUNCTION next_user_public_id() RETURNS TEXT AS $$
  SELECT 'USR-' || LPAD(nextval('user_public_id_seq')::TEXT, 3, '0');
$$ LANGUAGE SQL VOLATILE;

CREATE OR REPLACE FUNCTION next_supplier_public_id() RETURNS TEXT AS $$
  SELECT 'SUP-' || LPAD(nextval('supplier_public_id_seq')::TEXT, 3, '0');
$$ LANGUAGE SQL VOLATILE;

CREATE OR REPLACE FUNCTION next_garage_public_id() RETURNS TEXT AS $$
  SELECT 'GAG-' || LPAD(nextval('garage_public_id_seq')::TEXT, 3, '0');
$$ LANGUAGE SQL VOLATILE;

ALTER TABLE "users"
  ADD COLUMN "publicId" TEXT,
  ADD COLUMN "supplierPublicId" TEXT,
  ADD COLUMN "garagePublicId" TEXT,
  ADD COLUMN "supplierApprovalStatus" "SupplierApprovalStatus" NOT NULL DEFAULT 'Pending',
  ADD COLUMN "supplierReviewedAt" TIMESTAMP(3),
  ADD COLUMN "supplierReviewedByAdminId" TEXT;

UPDATE "users"
SET "publicId" = next_user_public_id()
WHERE "publicId" IS NULL;

UPDATE "users"
SET "supplierPublicId" = next_supplier_public_id()
WHERE "supplierPublicId" IS NULL
  AND (
    'Supplier'::"UserRole" = ANY("roles")
    OR "activeRole" = 'Supplier'::"UserRole"
  );

UPDATE "users"
SET "garagePublicId" = next_garage_public_id()
WHERE "garagePublicId" IS NULL
  AND (
    'Garage'::"UserRole" = ANY("roles")
    OR "activeRole" = 'Garage'::"UserRole"
  );

ALTER TABLE "users"
  ALTER COLUMN "publicId" SET DEFAULT next_user_public_id(),
  ALTER COLUMN "publicId" SET NOT NULL;

CREATE OR REPLACE FUNCTION assign_user_role_public_ids() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."publicId" IS NULL THEN
    NEW."publicId" := next_user_public_id();
  END IF;

  IF NEW."supplierPublicId" IS NULL
    AND (
      'Supplier'::"UserRole" = ANY(NEW."roles")
      OR NEW."activeRole" = 'Supplier'::"UserRole"
    ) THEN
    NEW."supplierPublicId" := next_supplier_public_id();
  END IF;

  IF NEW."garagePublicId" IS NULL
    AND (
      'Garage'::"UserRole" = ANY(NEW."roles")
      OR NEW."activeRole" = 'Garage'::"UserRole"
    ) THEN
    NEW."garagePublicId" := next_garage_public_id();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE TRIGGER users_assign_role_public_ids
BEFORE INSERT OR UPDATE OF "roles", "activeRole" ON "users"
FOR EACH ROW
EXECUTE FUNCTION assign_user_role_public_ids();

CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");
CREATE UNIQUE INDEX "users_supplierPublicId_key" ON "users"("supplierPublicId");
CREATE UNIQUE INDEX "users_garagePublicId_key" ON "users"("garagePublicId");
CREATE INDEX "users_supplierApprovalStatus_idx" ON "users"("supplierApprovalStatus");
CREATE INDEX "users_supplierReviewedByAdminId_idx" ON "users"("supplierReviewedByAdminId");

ALTER TABLE "users"
ADD CONSTRAINT "users_supplierReviewedByAdminId_fkey"
FOREIGN KEY ("supplierReviewedByAdminId") REFERENCES "admin"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
