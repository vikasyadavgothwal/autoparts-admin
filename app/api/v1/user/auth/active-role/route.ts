import { NextRequest, NextResponse } from "next/server"

import { updateActiveUserRoleViaApi } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isAllowedUserAuthOrigin } from "@/lib/user-auth/security"
import type { UpdateActiveRoleApiBody } from "@/types/user-auth/user-auth"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  let body: UpdateActiveRoleApiBody
  try {
    body = (await request.json()) as UpdateActiveRoleApiBody
  } catch {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid JSON body" },
      { status: 400 },
    )
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid request body" },
      { status: 400 },
    )
  }

  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const result = await updateActiveUserRoleViaApi(accessToken, body)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: result.statusCode },
    )
  }

  return NextResponse.json({
    ok: true,
    success: true,
    user: result.user,
  })
}
