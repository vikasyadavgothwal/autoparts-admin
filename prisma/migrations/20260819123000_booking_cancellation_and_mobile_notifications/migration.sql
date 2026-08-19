ALTER TABLE "garage_bookings"
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

ALTER TABLE "business_plans"
  ADD COLUMN IF NOT EXISTS "mobileNotifications" BOOLEAN NOT NULL DEFAULT true;
