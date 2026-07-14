CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientAdminId" TEXT,
  "actorUserId" TEXT,
  "actorAdminId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkUrl" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_one_recipient_check" CHECK (
    ("recipientUserId" IS NOT NULL AND "recipientAdminId" IS NULL)
    OR ("recipientUserId" IS NULL AND "recipientAdminId" IS NOT NULL)
  )
);

CREATE INDEX "notifications_recipientUserId_readAt_createdAt_idx"
  ON "notifications"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "notifications_recipientAdminId_readAt_createdAt_idx"
  ON "notifications"("recipientAdminId", "readAt", "createdAt");
CREATE INDEX "notifications_entityType_entityId_idx"
  ON "notifications"("entityType", "entityId");
CREATE INDEX "notifications_type_createdAt_idx"
  ON "notifications"("type", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientAdminId_fkey"
  FOREIGN KEY ("recipientAdminId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
