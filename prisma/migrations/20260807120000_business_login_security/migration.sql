CREATE TABLE IF NOT EXISTS "business_login_security" (
  "id" TEXT PRIMARY KEY,
  "businessAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pinHash" TEXT,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "otpConsumedAt" TIMESTAMP(3),
  "loginChallengeHash" TEXT,
  "loginChallengeExpiresAt" TIMESTAMP(3),
  "loginChallengeConsumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_login_security_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_login_security_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "business_login_security_businessAccountId_userId_key" ON "business_login_security"("businessAccountId", "userId");
CREATE INDEX IF NOT EXISTS "business_login_security_userId_idx" ON "business_login_security"("userId");
CREATE INDEX IF NOT EXISTS "business_login_security_loginChallengeHash_idx" ON "business_login_security"("loginChallengeHash");
