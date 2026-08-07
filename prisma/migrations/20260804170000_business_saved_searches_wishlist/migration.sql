CREATE TABLE "business_saved_searches" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "query" JSONB NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_saved_searches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_wishlist_items" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "title" TEXT,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_saved_searches_businessAccountId_scope_idx" ON "business_saved_searches"("businessAccountId", "scope");
CREATE INDEX "business_saved_searches_createdByUserId_idx" ON "business_saved_searches"("createdByUserId");
CREATE UNIQUE INDEX "business_wishlist_items_businessAccountId_itemType_itemId_key" ON "business_wishlist_items"("businessAccountId", "itemType", "itemId");
CREATE INDEX "business_wishlist_items_businessAccountId_createdAt_idx" ON "business_wishlist_items"("businessAccountId", "createdAt");
CREATE INDEX "business_wishlist_items_createdByUserId_idx" ON "business_wishlist_items"("createdByUserId");

ALTER TABLE "business_saved_searches" ADD CONSTRAINT "business_saved_searches_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_saved_searches" ADD CONSTRAINT "business_saved_searches_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_wishlist_items" ADD CONSTRAINT "business_wishlist_items_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_wishlist_items" ADD CONSTRAINT "business_wishlist_items_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
