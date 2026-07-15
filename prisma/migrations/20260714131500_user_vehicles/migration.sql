CREATE TABLE "user_vehicles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "vin" TEXT,
  "mileage" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_vehicles_userId_vin_key" ON "user_vehicles"("userId", "vin");
CREATE INDEX "user_vehicles_userId_isPrimary_idx" ON "user_vehicles"("userId", "isPrimary");
CREATE INDEX "user_vehicles_userId_createdAt_idx" ON "user_vehicles"("userId", "createdAt");

ALTER TABLE "user_vehicles"
  ADD CONSTRAINT "user_vehicles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
