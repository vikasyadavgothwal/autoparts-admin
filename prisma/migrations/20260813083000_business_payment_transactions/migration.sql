CREATE TABLE "business_payment_transactions" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "payerUserId" TEXT,
  "type" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceKey" TEXT,
  "description" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "status" TEXT NOT NULL DEFAULT 'Paid',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_payment_transactions_businessAccountId_createdAt_idx" ON "business_payment_transactions"("businessAccountId", "createdAt");
CREATE INDEX "business_payment_transactions_payerUserId_createdAt_idx" ON "business_payment_transactions"("payerUserId", "createdAt");
CREATE INDEX "business_payment_transactions_type_createdAt_idx" ON "business_payment_transactions"("type", "createdAt");

ALTER TABLE "business_payment_transactions"
  ADD CONSTRAINT "business_payment_transactions_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_payment_transactions"
  ADD CONSTRAINT "business_payment_transactions_payerUserId_fkey"
  FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
