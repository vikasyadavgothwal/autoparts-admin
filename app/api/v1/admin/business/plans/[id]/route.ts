import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest, readJsonBody } from "@/lib/auth/api-guards"
import { updateBusinessPlan } from "@/services/business/business-platform-service"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) {
    return NextResponse.json({ ok: false, message: body.message }, { status: 400 })
  }

  try {
    const { id } = await params
    return NextResponse.json({
      ok: true,
      plan: await updateBusinessPlan(id, body.body),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update plan",
      },
      { status: 400 },
    )
  }
}
