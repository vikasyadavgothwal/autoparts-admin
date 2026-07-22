import { randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { getFirebaseMessaging } from "@/lib/firebase/admin"
import type {
  DashboardNotification,
  NotificationScope,
} from "@/types/notifications/notifications"

type DeviceRow = {
  fcmToken: string
}

type RegisterNotificationDeviceInput = {
  fcmToken: string
  platform?: string | null
  deviceName?: string | null
  userAgent?: string | null
}

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : ""

const roleForScope = (scope: NotificationScope) =>
  scope.kind === "admin" ? "Admin" : "User"

export async function registerNotificationDevice(
  scope: NotificationScope,
  input: RegisterNotificationDeviceInput,
) {
  const fcmToken = cleanText(input.fcmToken, 4096)
  if (!fcmToken) throw new Error("FCM token is required")

  const platform = cleanText(input.platform, 32) || "web"
  const deviceName = cleanText(input.deviceName, 120) || null
  const userAgent = cleanText(input.userAgent, 500) || null
  const role = roleForScope(scope)

  if (scope.kind === "user") {
    await db.$executeRaw`
      INSERT INTO "notification_devices" (
        "id",
        "recipientUserId",
        "recipientAdminId",
        "role",
        "platform",
        "fcmToken",
        "deviceName",
        "userAgent",
        "lastSeenAt",
        "revokedAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${scope.id},
        NULL,
        ${role},
        ${platform},
        ${fcmToken},
        ${deviceName},
        ${userAgent},
        CURRENT_TIMESTAMP,
        NULL,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("fcmToken") DO UPDATE SET
        "recipientUserId" = EXCLUDED."recipientUserId",
        "recipientAdminId" = NULL,
        "role" = EXCLUDED."role",
        "platform" = EXCLUDED."platform",
        "deviceName" = EXCLUDED."deviceName",
        "userAgent" = EXCLUDED."userAgent",
        "lastSeenAt" = CURRENT_TIMESTAMP,
        "revokedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    `
    return
  }

  await db.$executeRaw`
    INSERT INTO "notification_devices" (
      "id",
      "recipientUserId",
      "recipientAdminId",
      "role",
      "platform",
      "fcmToken",
      "deviceName",
      "userAgent",
      "lastSeenAt",
      "revokedAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      NULL,
      ${scope.id},
      ${role},
      ${platform},
      ${fcmToken},
      ${deviceName},
      ${userAgent},
      CURRENT_TIMESTAMP,
      NULL,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("fcmToken") DO UPDATE SET
      "recipientUserId" = NULL,
      "recipientAdminId" = EXCLUDED."recipientAdminId",
      "role" = EXCLUDED."role",
      "platform" = EXCLUDED."platform",
      "deviceName" = EXCLUDED."deviceName",
      "userAgent" = EXCLUDED."userAgent",
      "lastSeenAt" = CURRENT_TIMESTAMP,
      "revokedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
  `
}

export async function revokeNotificationDevice(
  scope: NotificationScope,
  fcmToken: unknown,
) {
  const token = cleanText(fcmToken, 4096)
  if (!token) return

  if (scope.kind === "user") {
    await db.$executeRaw`
      UPDATE "notification_devices"
      SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "fcmToken" = ${token}
        AND "recipientUserId" = ${scope.id}
    `
    return
  }

  await db.$executeRaw`
    UPDATE "notification_devices"
    SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "fcmToken" = ${token}
      AND "recipientAdminId" = ${scope.id}
  `
}

async function revokeTokens(tokens: string[]) {
  if (!tokens.length) return
  await db.$executeRaw`
    UPDATE "notification_devices"
    SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "fcmToken" = ANY(${tokens})
  `
}

export async function sendNotificationPush(
  row: {
    recipientUserId: string | null
    recipientAdminId: string | null
  },
  notification: DashboardNotification,
) {
  const devices = row.recipientUserId
    ? await db.$queryRaw<DeviceRow[]>`
        SELECT "fcmToken"
        FROM "notification_devices"
        WHERE "recipientUserId" = ${row.recipientUserId}
          AND "revokedAt" IS NULL
      `
    : await db.$queryRaw<DeviceRow[]>`
        SELECT "fcmToken"
        FROM "notification_devices"
        WHERE "recipientAdminId" = ${row.recipientAdminId}
          AND "revokedAt" IS NULL
      `

  const tokens = devices.map((device) => device.fcmToken).filter(Boolean)
  if (!tokens.length) return

  try {
    const response = await getFirebaseMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId: notification.id,
        type: notification.type,
        linkUrl: notification.linkUrl ?? "",
        entityType: notification.entityType ?? "",
        entityId: notification.entityId ?? "",
      },
      webpush: {
        fcmOptions: {
          link: notification.linkUrl ?? "/",
        },
      },
    })

    const revokedTokens = response.responses
      .map((result, index) =>
        !result.success &&
        (result.error?.code === "messaging/registration-token-not-registered" ||
          result.error?.code === "messaging/invalid-registration-token")
          ? tokens[index]
          : null,
      )
      .filter((token): token is string => Boolean(token))

    await revokeTokens(revokedTokens)
  } catch (error) {
    console.error("Unable to send notification push", error)
  }
}
