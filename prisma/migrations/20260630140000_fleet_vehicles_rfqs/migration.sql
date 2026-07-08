CREATE TYPE "FleetVehicleStatus" AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE "RfqSource" AS ENUM ('fleet', 'user');
CREATE TYPE "RfqStatus" AS ENUM ('open', 'closed', 'cancelled');

CREATE TABLE "fleet_vehicles" (
  "id" TEXT NOT NULL,
  "fleetId" TEXT NOT NULL,
  "vehicleName" TEXT NOT NULL,
  "vin" TEXT NOT NULL,
  "mileage" INTEGER NOT NULL,
  "driver" TEXT,
  "status" "FleetVehicleStatus" NOT NULL DEFAULT 'active',
  "year" INTEGER NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "trim" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfqs" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT,
  "fleetVehicleId" TEXT,
  "source" "RfqSource" NOT NULL,
  "status" "RfqStatus" NOT NULL DEFAULT 'open',
  "projectName" TEXT NOT NULL,
  "description" TEXT,
  "responseDeadline" TIMESTAMP(3) NOT NULL,
  "deliveryRequirement" TEXT NOT NULL,
  "paymentTerms" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "vehicleVin" TEXT,
  "vehicleYear" INTEGER,
  "vehicleMake" TEXT,
  "vehicleModel" TEXT,
  "vehicleTrim" TEXT,
  "attachmentKey" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfq_parts" (
  "id" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "partName" TEXT NOT NULL,
  "partNumber" TEXT,
  "quantity" INTEGER NOT NULL,
  "targetPrice" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfq_parts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fleet_vehicles_fleetId_vin_key" ON "fleet_vehicles"("fleetId", "vin");
CREATE INDEX "fleet_vehicles_fleetId_status_idx" ON "fleet_vehicles"("fleetId", "status");
CREATE INDEX "fleet_vehicles_vin_idx" ON "fleet_vehicles"("vin");
CREATE INDEX "rfqs_requesterId_idx" ON "rfqs"("requesterId");
CREATE INDEX "rfqs_fleetVehicleId_idx" ON "rfqs"("fleetVehicleId");
CREATE INDEX "rfqs_status_createdAt_idx" ON "rfqs"("status", "createdAt");
CREATE INDEX "rfqs_source_idx" ON "rfqs"("source");
CREATE INDEX "rfq_parts_rfqId_idx" ON "rfq_parts"("rfqId");
CREATE INDEX "rfq_parts_partNumber_idx" ON "rfq_parts"("partNumber");

ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_fleetId_fkey"
FOREIGN KEY ("fleetId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_fleetVehicleId_fkey"
FOREIGN KEY ("fleetVehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfq_parts" ADD CONSTRAINT "rfq_parts_rfqId_fkey"
FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
