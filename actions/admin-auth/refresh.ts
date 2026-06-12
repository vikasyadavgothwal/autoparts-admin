"use server"

import { cookies } from "next/headers"
import { ADMIN_AUTH, getAdminCookieOptions } from "@/lib/auth/config"
import { getRequestContext } from "@/lib/auth/request"
import { refreshAdminSession } from "@/services/admin-auth/admin-auth-service"
import { appRoutes } from "@/lib/routes"
import { redirect } from "next/navigation"

const daysToSeconds = (days: number) => days * 24 * 60 * 60

export async function refreshAdminTokens() {
  const requestContext = await getRequestContext()
  const cookieStore = await cookies()
  const currentRefresh = cookieStore.get(ADMIN_AUTH.refreshCookieName)?.value
  const cookieOptions = getAdminCookieOptions()

  if (!currentRefresh) {
    redirect(`${appRoutes.login}?error=missing_refresh_token`)
  }

  const refreshed = await refreshAdminSession(currentRefresh, requestContext)

  if (!refreshed.ok) {
    cookieStore.delete(ADMIN_AUTH.accessCookieName)
    cookieStore.delete(ADMIN_AUTH.refreshCookieName)
    redirect(`${appRoutes.login}?error=${encodeURIComponent(refreshed.message)}`)
  }

  cookieStore.set({
    name: ADMIN_AUTH.accessCookieName,
    value: refreshed.accessToken,
    maxAge: ADMIN_AUTH.accessTokenTtlSeconds,
    ...cookieOptions,
  })

  cookieStore.set({
    name: ADMIN_AUTH.refreshCookieName,
    value: refreshed.refreshToken,
    maxAge: daysToSeconds(ADMIN_AUTH.refreshTokenTtlDays),
    ...cookieOptions,
  })

  return {
    ok: true,
  }
}
