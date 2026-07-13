CREATE TYPE "GarageBookingStatus" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

CREATE SEQUENCE IF NOT EXISTS garage_booking_public_id_seq START 1;

CREATE OR REPLACE FUNCTION next_garage_booking_public_id() RETURNS TEXT AS $$
  SELECT 'GB-' || LPAD(nextval('garage_booking_public_id_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL;

CREATE TABLE "garage_bookings" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT next_garage_booking_public_id(),
  "garageId" TEXT NOT NULL,
  "serviceId" TEXT,
  "serviceName" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT,
  "customerPhone" TEXT NOT NULL,
  "vehicleYear" TEXT,
  "vehicleMake" TEXT,
  "vehicleModel" TEXT,
  "vehicleVin" TEXT,
  "notes" TEXT,
  "bookingDate" DATE NOT NULL,
  "bookingTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "status" "GarageBookingStatus" NOT NULL DEFAULT 'confirmed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_bookings_publicId_key" ON "garage_bookings"("publicId");
CREATE INDEX "garage_bookings_garageId_bookingDate_bookingTime_idx" ON "garage_bookings"("garageId", "bookingDate", "bookingTime");
CREATE INDEX "garage_bookings_serviceId_idx" ON "garage_bookings"("serviceId");
CREATE INDEX "garage_bookings_status_idx" ON "garage_bookings"("status");

ALTER TABLE "garage_bookings" ADD CONSTRAINT "garage_bookings_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_bookings" ADD CONSTRAINT "garage_bookings_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "garage_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
