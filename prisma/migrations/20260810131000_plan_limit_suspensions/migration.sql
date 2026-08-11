ALTER TYPE "FleetVehicleStatus" ADD VALUE IF NOT EXISTS 'plan_suspended';
ALTER TYPE "GarageServiceStatus" ADD VALUE IF NOT EXISTS 'plan_suspended';

ALTER TABLE "fleet_vehicles"
  ADD COLUMN IF NOT EXISTS "planSuspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planSuspensionReason" TEXT;

ALTER TABLE "garage_services"
  ADD COLUMN IF NOT EXISTS "planSuspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planSuspensionReason" TEXT;

ALTER TABLE "supplier_parts"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "planSuspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planSuspensionReason" TEXT;
