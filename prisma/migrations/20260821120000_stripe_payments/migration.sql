CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "payerUserId" TEXT,
  "businessAccountId" TEXT,
  "purpose" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "status" TEXT NOT NULL DEFAULT 'requires_payment',
  "stripePaymentIntentId" TEXT,
  "stripeCheckoutSessionId" TEXT,
  "stripeCustomerId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_items" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stripe_webhook_events" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "objectId" TEXT,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_publicId_key" ON "payments"("publicId");
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");
CREATE UNIQUE INDEX "payments_stripeCheckoutSessionId_key" ON "payments"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_payerUserId_createdAt_idx" ON "payments"("payerUserId", "createdAt");
CREATE INDEX "payments_businessAccountId_createdAt_idx" ON "payments"("businessAccountId", "createdAt");
CREATE INDEX "payments_purpose_status_idx" ON "payments"("purpose", "status");

CREATE UNIQUE INDEX "payment_items_paymentId_entityType_entityId_key" ON "payment_items"("paymentId", "entityType", "entityId");
CREATE INDEX "payment_items_entityType_entityId_idx" ON "payment_items"("entityType", "entityId");

CREATE UNIQUE INDEX "stripe_webhook_events_stripeEventId_key" ON "stripe_webhook_events"("stripeEventId");
CREATE INDEX "stripe_webhook_events_eventType_objectId_idx" ON "stripe_webhook_events"("eventType", "objectId");

ALTER TABLE "payment_items"
  ADD CONSTRAINT "payment_items_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
