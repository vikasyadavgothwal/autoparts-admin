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

const requestOrigin = (request: NextRequest) => {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  if (!forwardedHost) return request.nextUrl.origin

  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https"

  return `${forwardedProto}://${forwardedHost}`
}

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"))
  const refreshToken = request.cookies.get(ADMIN_AUTH.refreshCookieName)?.value
  const origin = requestOrigin(request)

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login?error=missing_refresh_token", origin))
  }

  const refreshed = await refreshAdminSession(refreshToken, {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  })

  if (!refreshed.ok) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(refreshed.message)}`, origin),
    )
    response.cookies.delete(ADMIN_AUTH.accessCookieName)
    response.cookies.delete(ADMIN_AUTH.refreshCookieName)
    return response
  }

  const response = NextResponse.redirect(new URL(returnTo, origin))
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
