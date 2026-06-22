import { NextRequest, NextResponse } from "next/server"

import { revokeUserSessionViaApi } from "@/actions/user-auth/user-auth"
import { clearUserAuthCookies } from "@/lib/user-auth/cookies"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isAllowedUserAuthOrigin } from "@/lib/user-auth/security"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const result = await revokeUserSessionViaApi(accessToken, id)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: result.message === "Unauthorized" ? 401 : 404 },
    )
  }

  const response = NextResponse.json({
    ok: true,
    success: true,
    message: "Session revoked",
  })
  if (result.current) {
    clearUserAuthCookies(response)
  }
  return response
}
