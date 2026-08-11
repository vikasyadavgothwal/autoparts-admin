ALTER TABLE "business_plans"
  ADD COLUMN IF NOT EXISTS "securityTier" TEXT NOT NULL DEFAULT 'Basic',
  ADD COLUMN IF NOT EXISTS "supportTier" TEXT NOT NULL DEFAULT 'Basic',
  ADD COLUMN IF NOT EXISTS "loginSecurityMode" TEXT NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS "reportLevel" TEXT NOT NULL DEFAULT 'dashboard';

UPDATE "business_plans"
SET
  "securityTier" = CASE
    WHEN "code" = 'Enterprise' THEN 'Premium'
    WHEN "code" = 'Pro' THEN 'Standard'
    ELSE 'Basic'
  END,
  "supportTier" = CASE
    WHEN "code" = 'Enterprise' THEN 'Premium'
    WHEN "code" = 'Pro' THEN 'Standard'
    ELSE 'Basic'
  END,
  "loginSecurityMode" = CASE
    WHEN "code" = 'Enterprise' THEN 'pin_or_otp'
    WHEN "code" = 'Pro' THEN 'otp'
    ELSE 'password'
  END,
  "reportLevel" = CASE
    WHEN "code" = 'Enterprise' THEN 'premium'
    WHEN "code" = 'Pro' THEN 'standard'
    ELSE 'dashboard'
  END;

UPDATE "business_plans"
SET
  "staffLimit" = 0,
  "roleLimit" = 0,
  "serviceLimit" = 3,
  "appointmentLimit" = 5,
  "dashboardReports" = TRUE,
  "usageReports" = FALSE,
  "activityReports" = FALSE
WHERE "accountType" = 'Garage' AND "code" = 'Free';
