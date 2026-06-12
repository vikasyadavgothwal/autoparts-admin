"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { appRoutes } from "@/lib/routes"
import { ADMIN_AUTH } from "@/lib/auth/config"
import { logoutByRefreshToken } from "@/services/admin-auth/admin-auth-service"

export async function logoutAdmin() {
  const cookieStore = await cookies()
  const currentRefresh = cookieStore.get(ADMIN_AUTH.refreshCookieName)?.value

  if (currentRefresh) {
    await logoutByRefreshToken(currentRefresh)
  }

  cookieStore.delete(ADMIN_AUTH.accessCookieName)
  cookieStore.delete(ADMIN_AUTH.refreshCookieName)
  redirect(appRoutes.login)
}
