import { NextRequest, NextResponse } from "next/server"

import { logoutAllUserSessionsViaApi } from "@/actions/user-auth/user-auth"
import { clearUserAuthCookies } from "@/lib/user-auth/cookies"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isAllowedUserAuthOrigin } from "@/lib/user-auth/security"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const loggedOut = await logoutAllUserSessionsViaApi(accessToken)
  const response = NextResponse.json(
    loggedOut
      ? {
          ok: true,
          success: true,
          message: "All sessions logged out successfully",
        }
      : { ok: false, success: false, message: "Unauthorized" },
    { status: loggedOut ? 200 : 401 },
  )
  clearUserAuthCookies(response)
  return response
}
