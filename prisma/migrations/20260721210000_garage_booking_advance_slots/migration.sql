CREATE TABLE "platform_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "platform_settings" ("key", "value")
VALUES ('garage_booking_advance_percentage', '10');

ALTER TABLE "garage_bookings"
  ADD COLUMN "advancePercentage" INTEGER,
  ADD COLUMN "advanceAmount" INTEGER,
  ADD COLUMN "advancePaymentStatus" TEXT,
  ADD COLUMN "advancePaidAt" TIMESTAMP(3);
