"use server"

import { cookies } from "next/headers"

import { ADMIN_AUTH } from "@/lib/auth/config"
import { getAdminByAccessToken } from "@/services/admin-auth/admin-auth-service"

export async function getCurrentAdminSession(): Promise<{
  ok: true
  admin: {
    id: string
    email: string
    name: string | null
    isActive: boolean
  },
} | { ok: false }> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ADMIN_AUTH.accessCookieName)?.value

  if (accessToken) {
    const accessResult = await getAdminByAccessToken(accessToken)
    if (accessResult.ok) {
      return {
        ok: true,
        admin: accessResult.admin,
      }
    }
  }

  return { ok: false }
}
