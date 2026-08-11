ALTER TABLE "business_add_on_requests"
ADD COLUMN "validFrom" TIMESTAMP(3),
ADD COLUMN "validUntil" TIMESTAMP(3),
ADD COLUMN "renewalAt" TIMESTAMP(3);

CREATE INDEX "business_add_on_requests_validUntil_idx"
ON "business_add_on_requests"("validUntil");
