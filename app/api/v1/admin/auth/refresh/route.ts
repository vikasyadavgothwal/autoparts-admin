import { NextRequest, NextResponse } from "next/server"

import { ADMIN_AUTH, getAdminCookieOptions } from "@/lib/auth/config"
import { refreshAdminSession } from "@/services/admin-auth/admin-auth-service"

const daysToSeconds = (days: number) => days * 24 * 60 * 60

const safeReturnTo = (value: string | null) =>
  value?.startsWith("/") &&
  !value.startsWith("//") &&
  !value.startsWith("/api/")
    ? value
    : "/"

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"))
  const refreshToken = request.cookies.get(ADMIN_AUTH.refreshCookieName)?.value

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login?error=missing_refresh_token", request.url))
  }

  const refreshed = await refreshAdminSession(refreshToken, {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  })

  if (!refreshed.ok) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(refreshed.message)}`, request.url),
    )
    response.cookies.delete(ADMIN_AUTH.accessCookieName)
    response.cookies.delete(ADMIN_AUTH.refreshCookieName)
    return response
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url))
  const cookieOptions = getAdminCookieOptions()
  response.cookies.set({
    name: ADMIN_AUTH.accessCookieName,
    value: refreshed.accessToken,
    maxAge: ADMIN_AUTH.accessTokenTtlSeconds,
    ...cookieOptions,
  })
  response.cookies.set({
    name: ADMIN_AUTH.refreshCookieName,
    value: refreshed.refreshToken,
    maxAge: daysToSeconds(ADMIN_AUTH.refreshTokenTtlDays),
    ...cookieOptions,
  })

  return response
}
