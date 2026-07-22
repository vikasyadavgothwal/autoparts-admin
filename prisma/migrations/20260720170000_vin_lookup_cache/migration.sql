CREATE TABLE "vin_lookup_cache" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vin_lookup_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vin_lookup_cache_vin_key" ON "vin_lookup_cache"("vin");
CREATE INDEX "vin_lookup_cache_vin_idx" ON "vin_lookup_cache"("vin");
