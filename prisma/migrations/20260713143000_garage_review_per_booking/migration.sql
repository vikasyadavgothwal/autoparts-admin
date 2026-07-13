UPDATE "garage_service_reviews" r
SET "bookingId" = (
  SELECT gb."id"
  FROM "garage_bookings" gb
  WHERE gb."customerId" = r."customerId"
    AND gb."serviceId" = r."serviceId"
    AND gb."status" = 'completed'::"GarageBookingStatus"
    AND NOT EXISTS (
      SELECT 1
      FROM "garage_service_reviews" existing
      WHERE existing."bookingId" = gb."id"
    )
  ORDER BY gb."createdAt" DESC
  LIMIT 1
)
WHERE r."bookingId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "garage_bookings" gb
    WHERE gb."customerId" = r."customerId"
      AND gb."serviceId" = r."serviceId"
      AND gb."status" = 'completed'::"GarageBookingStatus"
      AND NOT EXISTS (
        SELECT 1
        FROM "garage_service_reviews" existing
        WHERE existing."bookingId" = gb."id"
      )
  );

DROP INDEX IF EXISTS "garage_service_reviews_customerId_serviceId_key";
