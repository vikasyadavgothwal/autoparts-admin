CREATE TABLE "user_addresses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "landmark" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_addresses_userId_isDefault_idx" ON "user_addresses"("userId", "isDefault");
CREATE INDEX "user_addresses_userId_createdAt_idx" ON "user_addresses"("userId", "createdAt");

ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "deliveryAddressId" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryRecipientName" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryPhone" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryAddressLine1" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryAddressLine2" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryLandmark" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryCity" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryState" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryPostalCode" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryCountry" TEXT;

CREATE INDEX "orders_deliveryAddressId_idx" ON "orders"("deliveryAddressId");

ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryAddressId_fkey"
FOREIGN KEY ("deliveryAddressId") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
