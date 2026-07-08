import { NextRequest, NextResponse } from "next/server"

import { listUserSessionsViaApi } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const result = await listUserSessionsViaApi(accessToken)

  return result.ok
    ? NextResponse.json({
        ok: true,
        success: true,
        sessions: result.sessions,
      })
    : NextResponse.json(
        { ok: false, success: false, message: result.message },
        { status: 401 },
      )
}
