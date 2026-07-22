CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

ALTER TABLE "orders"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "supplierConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "proofOfDeliveryUrl" TEXT,
  ADD COLUMN "proofOfDeliveryKey" TEXT,
  ADD COLUMN "proofOfDeliveryNote" TEXT,
  ADD COLUMN "proofRecipientName" TEXT,
  ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);

UPDATE "orders"
SET "paymentStatus" = 'succeeded', "paidAt" = "createdAt"
WHERE "status" <> 'cancelled';
