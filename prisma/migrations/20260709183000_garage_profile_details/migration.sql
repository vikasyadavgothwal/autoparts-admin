ALTER TABLE "garage_profiles"
  ADD COLUMN "workingHoursByDay" JSONB,
  ADD COLUMN "garageImageKey" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "pincode" TEXT,
  ADD COLUMN "galleryImageKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
