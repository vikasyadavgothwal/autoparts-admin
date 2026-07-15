CREATE TYPE "GarageVerificationTarget" AS ENUM ('email', 'mobile');

CREATE TABLE "garage_profiles" (
  "id" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactEmailVerifiedAt" TIMESTAMP(3),
  "mobile" TEXT,
  "mobileVerifiedAt" TIMESTAMP(3),
  "workingDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workingHours" TEXT,
  "garageImageUrl" TEXT,
  "address" TEXT,
  "jobCompletedNumber" INTEGER NOT NULL DEFAULT 0,
  "yearsExperience" INTEGER NOT NULL DEFAULT 0,
  "responseTime" TEXT,
  "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "about" TEXT,
  "galleryImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "garage_verification_requests" (
  "id" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "target" "GarageVerificationTarget" NOT NULL,
  "targetValue" TEXT NOT NULL,
  "tokenHash" TEXT,
  "otpHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "garage_verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_profiles_garageId_key" ON "garage_profiles"("garageId");
CREATE INDEX "garage_profiles_contactEmail_idx" ON "garage_profiles"("contactEmail");
CREATE INDEX "garage_profiles_mobile_idx" ON "garage_profiles"("mobile");
CREATE INDEX "garage_verification_requests_garageId_target_consumedAt_idx"
  ON "garage_verification_requests"("garageId", "target", "consumedAt");
CREATE INDEX "garage_verification_requests_expiresAt_idx"
  ON "garage_verification_requests"("expiresAt");

ALTER TABLE "garage_profiles" ADD CONSTRAINT "garage_profiles_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_verification_requests" ADD CONSTRAINT "garage_verification_requests_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
