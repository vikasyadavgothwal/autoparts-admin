CREATE TABLE "notification_devices" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientAdminId" TEXT,
  "role" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "fcmToken" TEXT NOT NULL,
  "deviceName" TEXT,
  "userAgent" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_devices_one_recipient_check" CHECK (
    ("recipientUserId" IS NOT NULL AND "recipientAdminId" IS NULL)
    OR ("recipientUserId" IS NULL AND "recipientAdminId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "notification_devices_fcmToken_key"
  ON "notification_devices"("fcmToken");
CREATE INDEX "notification_devices_recipientUserId_revokedAt_lastSeenAt_idx"
  ON "notification_devices"("recipientUserId", "revokedAt", "lastSeenAt");
CREATE INDEX "notification_devices_recipientAdminId_revokedAt_lastSeenAt_idx"
  ON "notification_devices"("recipientAdminId", "revokedAt", "lastSeenAt");
CREATE INDEX "notification_devices_platform_revokedAt_idx"
  ON "notification_devices"("platform", "revokedAt");

ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_recipientAdminId_fkey"
  FOREIGN KEY ("recipientAdminId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
