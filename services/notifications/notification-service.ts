import { randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { Prisma, UserRole } from "@/lib/generated/prisma/client"
import { logError } from "@/lib/logger"
import {
  notificationChannel,
  publishNotification,
} from "@/services/notifications/notification-events"
import { sendNotificationPush } from "@/services/notifications/push-service"
import type {
  DashboardNotification,
  NotificationListResult,
  NotificationScope,
} from "@/types/notifications/notifications"

type NotificationRow = {
  id: string
  recipientUserId: string | null
  recipientAdminId: string | null
  actorUserId: string | null
  actorAdminId: string | null
  type: string
  title: string
  body: string
  linkUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CreateNotificationInput = {
  recipientUserId?: string | null
  recipientAdminId?: string | null
  actorUserId?: string | null
  actorAdminId?: string | null
  type: string
  title: string
  body: string
  linkUrl?: string | null
  entityType?: string | null
  entityId?: string | null
}

const notificationSelect = Prisma.sql`
  SELECT
    "id",
    "recipientUserId",
    "recipientAdminId",
    "actorUserId",
    "actorAdminId",
    "type",
    "title",
    "body",
    "linkUrl",
    "entityType",
    "entityId",
    "readAt",
    "createdAt",
    "updatedAt"
  FROM "notifications"
`

const serializeNotification = (
  row: NotificationRow,
): DashboardNotification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  linkUrl: row.linkUrl,
  entityType: row.entityType,
  entityId: row.entityId,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const hasSingleRecipient = (input: CreateNotificationInput) =>
  Boolean(input.recipientUserId) !== Boolean(input.recipientAdminId)

export async function createNotification(input: CreateNotificationInput) {
  if (!hasSingleRecipient(input)) {
    throw new Error("Notification requires exactly one recipient")
  }

  const [row] = await db.$queryRaw<NotificationRow[]>`
    INSERT INTO "notifications" (
      "id",
      "recipientUserId",
      "recipientAdminId",
      "actorUserId",
      "actorAdminId",
      "type",
      "title",
      "body",
      "linkUrl",
      "entityType",
      "entityId",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.recipientUserId ?? null},
      ${input.recipientAdminId ?? null},
      ${input.actorUserId ?? null},
      ${input.actorAdminId ?? null},
      ${input.type},
      ${input.title},
      ${input.body},
      ${input.linkUrl ?? null},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      CURRENT_TIMESTAMP
    )
    RETURNING
      "id",
      "recipientUserId",
      "recipientAdminId",
      "actorUserId",
      "actorAdminId",
      "type",
      "title",
      "body",
      "linkUrl",
      "entityType",
      "entityId",
      "readAt",
      "createdAt",
      "updatedAt"
  `

  if (!row) throw new Error("Unable to create notification")

  const notification = serializeNotification(row)
  publishNotification(notificationChannel(row), notification)
  await sendNotificationPush(row, notification)
  return notification
}

export async function createNotificationsSafely(
  inputs: CreateNotificationInput[],
) {
  for (const input of inputs) {
    try {
      await createNotification(input)
    } catch (error) {
      logError("Unable to create notification", error)
    }
  }
}

export async function listNotifications(
  scope: NotificationScope,
  limit = 20,
): Promise<NotificationListResult> {
  const safeLimit = Math.min(50, Math.max(1, limit))

  if (scope.kind === "user") {
    const [notifications, unreadCount] = await Promise.all([
      db.$queryRaw<NotificationRow[]>`
        ${notificationSelect}
        WHERE "recipientUserId" = ${scope.id}
        ORDER BY "createdAt" DESC
        LIMIT ${safeLimit}
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS "count"
        FROM "notifications"
        WHERE "recipientUserId" = ${scope.id}
          AND "readAt" IS NULL
      `,
    ])
    return {
      notifications: notifications.map(serializeNotification),
      unreadCount: Number(unreadCount[0]?.count ?? 0),
    }
  }

  const [notifications, unreadCount] = await Promise.all([
    db.$queryRaw<NotificationRow[]>`
      ${notificationSelect}
      WHERE "recipientAdminId" = ${scope.id}
      ORDER BY "createdAt" DESC
      LIMIT ${safeLimit}
    `,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "notifications"
      WHERE "recipientAdminId" = ${scope.id}
        AND "readAt" IS NULL
    `,
  ])

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount: Number(unreadCount[0]?.count ?? 0),
  }
}

export async function markNotificationRead(
  scope: NotificationScope,
  notificationId: string,
) {
  if (scope.kind === "user") {
    const [row] = await db.$queryRaw<NotificationRow[]>`
      UPDATE "notifications"
      SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${notificationId}
        AND "recipientUserId" = ${scope.id}
      RETURNING
        "id",
        "recipientUserId",
        "recipientAdminId",
        "actorUserId",
        "actorAdminId",
        "type",
        "title",
        "body",
        "linkUrl",
        "entityType",
        "entityId",
        "readAt",
        "createdAt",
        "updatedAt"
    `
    return row ? serializeNotification(row) : null
  }

  const [row] = await db.$queryRaw<NotificationRow[]>`
    UPDATE "notifications"
    SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${notificationId}
      AND "recipientAdminId" = ${scope.id}
    RETURNING
      "id",
      "recipientUserId",
      "recipientAdminId",
      "actorUserId",
      "actorAdminId",
      "type",
      "title",
      "body",
      "linkUrl",
      "entityType",
      "entityId",
      "readAt",
      "createdAt",
      "updatedAt"
  `
  return row ? serializeNotification(row) : null
}

export async function markAllNotificationsRead(scope: NotificationScope) {
  if (scope.kind === "user") {
    await db.$executeRaw`
      UPDATE "notifications"
      SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "recipientUserId" = ${scope.id}
        AND "readAt" IS NULL
    `
    return
  }

  await db.$executeRaw`
    UPDATE "notifications"
    SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "recipientAdminId" = ${scope.id}
      AND "readAt" IS NULL
  `
}

export async function activeAdminRecipientIds() {
  const admins = await db.admin.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  return admins.map((admin) => admin.id)
}

export async function activeSupplierRecipientIds() {
  const suppliers = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { activeRole: UserRole.Supplier },
        { roles: { has: UserRole.Supplier } },
      ],
    },
    select: { id: true },
  })
  return suppliers.map((supplier) => supplier.id)
}

export function notificationScopeChannel(scope: NotificationScope) {
  return `${scope.kind}:${scope.id}`
}
