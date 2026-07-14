import { NextRequest, NextResponse } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import { markNotificationRead } from "@/services/notifications/notification-service"

type NotificationReadContext = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: NotificationReadContext,
) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const notification = await markNotificationRead(auth.scope, id)
  if (!notification) {
    return NextResponse.json(
      { ok: false, message: "Notification not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, notification })
}
