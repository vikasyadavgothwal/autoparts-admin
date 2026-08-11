UPDATE "business_plans"
SET "loginSecurityMode" = 'otp'
WHERE "loginSecurityMode" = 'pin_or_otp';
