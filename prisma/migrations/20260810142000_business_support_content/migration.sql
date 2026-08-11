ALTER TABLE "business_support_tickets"
  ADD COLUMN IF NOT EXISTS "category" TEXT;

CREATE TABLE IF NOT EXISTS "business_support_videos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountType" "BusinessAccountType" NOT NULL,
  "supportTier" TEXT NOT NULL DEFAULT 'Basic',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "videoUrl" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "business_support_faqs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountType" "BusinessAccountType" NOT NULL,
  "supportTier" TEXT NOT NULL DEFAULT 'Basic',
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "business_support_videos_accountType_supportTier_isActive_idx"
  ON "business_support_videos"("accountType", "supportTier", "isActive");

CREATE INDEX IF NOT EXISTS "business_support_faqs_accountType_supportTier_isActive_idx"
  ON "business_support_faqs"("accountType", "supportTier", "isActive");
