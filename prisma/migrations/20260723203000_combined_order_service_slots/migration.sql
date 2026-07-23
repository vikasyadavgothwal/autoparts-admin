ALTER TYPE "GarageBookingStatus" ADD VALUE IF NOT EXISTS 'pending_slot_selection';

ALTER TABLE "garage_bookings"
  ALTER COLUMN "bookingDate" DROP NOT NULL,
  ALTER COLUMN "bookingTime" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "linkedOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "slotSelectedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'garage_bookings_linkedOrderId_fkey'
  ) THEN
    ALTER TABLE "garage_bookings"
      ADD CONSTRAINT "garage_bookings_linkedOrderId_fkey"
      FOREIGN KEY ("linkedOrderId") REFERENCES "orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "garage_bookings_linkedOrderId_idx" ON "garage_bookings"("linkedOrderId");
