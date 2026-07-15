import { NextRequest, NextResponse } from "next/server"

import { setUserAccountStatus } from "@/actions/admin-dashboard/users/user-management"
import { readJsonBody, requireAdminFromRequest } from "@/lib/parts-mapping/auth"

type RouteContext = { params: Promise<{ id: string }> }
type UpdateUserBody = { isActive?: unknown }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<UpdateUserBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  if (typeof parsed.body.isActive !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "isActive must be a boolean" },
      { status: 400 },
    )
  }

  try {
    const user = await setUserAccountStatus(
      (await context.params).id,
      parsed.body.isActive,
    )
    return NextResponse.json({ ok: true, user })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update user",
      },
      { status: 400 },
    )
  }
}
