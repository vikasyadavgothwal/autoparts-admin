import type { NextResponse } from "next/server"

import { getUserCookieOptions, USER_AUTH } from "@/lib/user-auth/config"
import type { IssuedUserSession } from "@/types/user-auth/user-auth"

const daysToSeconds = (days: number): number => days * 24 * 60 * 60

export function setUserAuthCookies(
  response: NextResponse,
  issued: Omit<IssuedUserSession, "sessionId">,
): void {
  const options = getUserCookieOptions()

  response.cookies.set({
    name: USER_AUTH.accessCookieName,
    value: issued.accessToken,
    maxAge: USER_AUTH.accessTokenTtlSeconds,
    ...options,
  })
  response.cookies.set({
    name: USER_AUTH.refreshCookieName,
    value: issued.refreshToken,
    maxAge: daysToSeconds(USER_AUTH.refreshTokenTtlDays),
    ...options,
  })
}

export function clearUserAuthCookies(response: NextResponse): void {
  const options = getUserCookieOptions()

  response.cookies.set({
    name: USER_AUTH.accessCookieName,
    value: "",
    maxAge: 0,
    ...options,
  })
  response.cookies.set({
    name: USER_AUTH.refreshCookieName,
    value: "",
    maxAge: 0,
    ...options,
  })
}
