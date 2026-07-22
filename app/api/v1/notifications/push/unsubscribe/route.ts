import { NextRequest, NextResponse } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import { revokeNotificationDevice } from "@/services/notifications/push-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const payload = (await request.json()) as { fcmToken?: unknown }
    await revokeNotificationDevice(auth.scope, payload.fcmToken)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
