import { NextRequest, NextResponse } from "next/server"

import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const auth = await requireUserAuth(accessToken)

  if (!auth) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    )
  }

  return NextResponse.json({
    ok: true,
    success: true,
    user: auth.user,
  })
}
