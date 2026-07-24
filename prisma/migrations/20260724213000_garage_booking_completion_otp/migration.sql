CREATE TABLE "garage_booking_completion_otps" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "garage_booking_completion_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "garage_booking_completion_otps_bookingId_idx"
  ON "garage_booking_completion_otps"("bookingId");

CREATE INDEX "garage_booking_completion_otps_garageId_idx"
  ON "garage_booking_completion_otps"("garageId");

CREATE INDEX "garage_booking_completion_otps_expiresAt_idx"
  ON "garage_booking_completion_otps"("expiresAt");

ALTER TABLE "garage_booking_completion_otps"
  ADD CONSTRAINT "garage_booking_completion_otps_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "garage_bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
