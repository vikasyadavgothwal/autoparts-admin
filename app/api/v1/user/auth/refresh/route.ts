import { NextRequest, NextResponse } from "next/server"

import { refreshUserViaApi } from "@/actions/user-auth/user-auth"
import {
  clearUserAuthCookies,
  setUserAuthCookies,
} from "@/lib/user-auth/cookies"
import { USER_AUTH } from "@/lib/user-auth/config"
import {
  consumeUserAuthRateLimit,
  getClientIp,
  getUserRequestContext,
  isAllowedUserAuthOrigin,
} from "@/lib/user-auth/security"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  const rateLimit = await consumeUserAuthRateLimit(
    `user-refresh:${getClientIp(request) ?? "unknown"}`,
    30,
    5 * 60 * 1_000,
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, success: false, message: "Too many refresh attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  const refreshToken =
    request.cookies.get(USER_AUTH.refreshCookieName)?.value ?? null
  const result = await refreshUserViaApi(
    refreshToken,
    getUserRequestContext(request),
  )

  if (!result.ok) {
    const response = NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: 401 },
    )
    clearUserAuthCookies(response)
    return response
  }

  const response = NextResponse.json({
    ok: true,
    success: true,
    expiresAt: result.issued.accessExpiresAt.toISOString(),
  })
  setUserAuthCookies(response, result.issued)
  return response
}
