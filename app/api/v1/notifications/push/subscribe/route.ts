import { NextRequest, NextResponse } from "next/server"

import { getNotificationScopeFromRequest } from "@/lib/notifications/auth"
import { registerNotificationDevice } from "@/services/notifications/push-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await getNotificationScopeFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const payload = (await request.json()) as {
      fcmToken?: unknown
      platform?: unknown
      deviceName?: unknown
    }

    await registerNotificationDevice(auth.scope, {
      fcmToken: String(payload.fcmToken ?? ""),
      platform: typeof payload.platform === "string" ? payload.platform : "web",
      deviceName:
        typeof payload.deviceName === "string" ? payload.deviceName : null,
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to register push notifications",
      },
      { status: 400 },
    )
  }
}
