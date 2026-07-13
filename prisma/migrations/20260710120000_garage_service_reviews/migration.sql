CREATE TABLE "garage_service_reviews" (
  "id" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "bookingId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "garageReply" TEXT,
  "garageReplyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "garage_service_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "garage_service_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "garage_service_reviews_bookingId_key" ON "garage_service_reviews"("bookingId");
CREATE UNIQUE INDEX "garage_service_reviews_customerId_serviceId_key" ON "garage_service_reviews"("customerId", "serviceId");
CREATE INDEX "garage_service_reviews_garageId_createdAt_idx" ON "garage_service_reviews"("garageId", "createdAt");
CREATE INDEX "garage_service_reviews_serviceId_rating_idx" ON "garage_service_reviews"("serviceId", "rating");

ALTER TABLE "garage_service_reviews" ADD CONSTRAINT "garage_service_reviews_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_service_reviews" ADD CONSTRAINT "garage_service_reviews_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "garage_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_service_reviews" ADD CONSTRAINT "garage_service_reviews_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_service_reviews" ADD CONSTRAINT "garage_service_reviews_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "garage_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
