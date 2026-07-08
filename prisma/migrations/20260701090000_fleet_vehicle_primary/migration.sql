ALTER TABLE "fleet_vehicles"
ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "fleet_vehicles_one_primary_per_fleet"
ON "fleet_vehicles"("fleetId")
WHERE "isPrimary" = true;
