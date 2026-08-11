import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import { assignAdminBusinessAccountPlan, getBusinessAccount } from "@/services/business/business-platform-service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const { id } = await params
  const account = await getBusinessAccount(id)
  if (!account) {
    return NextResponse.json(
      { ok: false, message: "Business account was not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, account })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{ planId?: unknown }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const { id } = await params
    const plan = await assignAdminBusinessAccountPlan({
      adminId: auth.admin.id,
      businessAccountId: id,
      planId: body.body.planId,
    })
    return NextResponse.json({ ok: true, plan })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to assign business plan"))
  }
}
