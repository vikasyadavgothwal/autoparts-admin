CREATE TABLE "business_api_keys" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdByUserId" TEXT,
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_api_keys_keyPrefix_key" ON "business_api_keys"("keyPrefix");
CREATE UNIQUE INDEX "business_api_keys_keyHash_key" ON "business_api_keys"("keyHash");
CREATE INDEX "business_api_keys_businessAccountId_status_idx" ON "business_api_keys"("businessAccountId", "status");
CREATE INDEX "business_api_keys_keyHash_idx" ON "business_api_keys"("keyHash");
CREATE INDEX "business_api_keys_lastUsedAt_idx" ON "business_api_keys"("lastUsedAt");

ALTER TABLE "business_api_keys"
  ADD CONSTRAINT "business_api_keys_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
