import { NextRequest, NextResponse } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import { listNotifications } from "@/services/notifications/notification-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  const limit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "20",
    10,
  )

  return NextResponse.json({
    ok: true,
    ...(await listNotifications(auth.scope, limit)),
  })
}
