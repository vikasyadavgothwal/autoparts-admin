ALTER TABLE "garage_bookings" ADD COLUMN "customerId" TEXT;

CREATE INDEX "garage_bookings_customerId_idx" ON "garage_bookings"("customerId");

ALTER TABLE "garage_bookings" ADD CONSTRAINT "garage_bookings_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
