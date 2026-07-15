import { NextRequest, NextResponse } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import {
  listNotifications,
  markAllNotificationsRead,
} from "@/services/notifications/notification-service"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  await markAllNotificationsRead(auth.scope)

  return NextResponse.json({
    ok: true,
    ...(await listNotifications(auth.scope)),
  })
}
