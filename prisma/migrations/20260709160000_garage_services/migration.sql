CREATE TYPE "GarageServiceStatus" AS ENUM ('active', 'inactive');

CREATE SEQUENCE IF NOT EXISTS garage_service_public_id_seq START 1;

CREATE OR REPLACE FUNCTION next_garage_service_public_id() RETURNS TEXT AS $$
  SELECT 'SRV-' || LPAD(nextval('garage_service_public_id_seq')::TEXT, 3, '0');
$$ LANGUAGE SQL;

CREATE TABLE "garage_services" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT next_garage_service_public_id(),
  "garageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "bookingsCount" INTEGER NOT NULL DEFAULT 0,
  "status" "GarageServiceStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_services_publicId_key" ON "garage_services"("publicId");
CREATE INDEX "garage_services_garageId_status_idx" ON "garage_services"("garageId", "status");
CREATE INDEX "garage_services_garageId_createdAt_idx" ON "garage_services"("garageId", "createdAt");

ALTER TABLE "garage_services" ADD CONSTRAINT "garage_services_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
