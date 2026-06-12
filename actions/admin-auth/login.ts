"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import { appRoutes } from "@/lib/routes"
import { getRequestContext } from "@/lib/auth/request"
import { ADMIN_AUTH, getAdminCookieOptions } from "@/lib/auth/config"
import {
  authenticateAdmin,
  createAdminSession,
} from "@/services/admin-auth/admin-auth-service"
import type { AdminCredentialInput } from "@/types/admin-auth/admin-auth"

const toRefreshSeconds = (days: number) => days * 24 * 60 * 60

export async function loginAdmin(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    redirect(`${appRoutes.login}?error=missing_credentials`)
  }

  const auth = await authenticateAdmin({ email, password } as AdminCredentialInput)

  if (!auth.ok) {
    redirect(`${appRoutes.login}?error=${encodeURIComponent(auth.message)}`)
  }

  const requestContext = await getRequestContext()
  const issued = await createAdminSession(auth.admin.id, requestContext)
  const cookieOptions = getAdminCookieOptions()
  const cookieStore = await cookies()

  cookieStore.set({
    name: ADMIN_AUTH.accessCookieName,
    value: issued.accessToken,
    maxAge: ADMIN_AUTH.accessTokenTtlSeconds,
    ...cookieOptions,
  })

  cookieStore.set({
    name: ADMIN_AUTH.refreshCookieName,
    value: issued.refreshToken,
    maxAge: toRefreshSeconds(ADMIN_AUTH.refreshTokenTtlDays),
    ...cookieOptions,
  })

  redirect(appRoutes.overview)
}
