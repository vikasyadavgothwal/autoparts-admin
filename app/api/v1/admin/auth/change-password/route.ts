import { NextRequest, NextResponse } from "next/server"

import { ADMIN_AUTH, getAdminCookieOptions } from "@/lib/auth/config"
import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import { changeAdminPassword } from "@/services/admin-auth/admin-auth-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{
    currentPassword?: unknown
    newPassword?: unknown
  }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const result = await changeAdminPassword({
      adminId: auth.admin.id,
      currentPassword: typeof body.body.currentPassword === "string" ? body.body.currentPassword : "",
      newPassword: typeof body.body.newPassword === "string" ? body.body.newPassword : "",
    })
    if (!result.ok) return apiError(result.message)

    const response = NextResponse.json({ ok: true })
    const cookieOptions = getAdminCookieOptions()
    response.cookies.set({ name: ADMIN_AUTH.accessCookieName, value: "", maxAge: 0, ...cookieOptions })
    response.cookies.set({ name: ADMIN_AUTH.refreshCookieName, value: "", maxAge: 0, ...cookieOptions })
    return response
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to change password"))
  }
}
