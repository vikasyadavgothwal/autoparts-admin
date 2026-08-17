import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  createAdminBusinessAddOnRequest,
  listAdminBusinessAddOnRequests,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    addOnRequests: await listAdminBusinessAddOnRequests(request.nextUrl.searchParams.get("status")),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{
    businessAccountId?: unknown
    featureKey?: unknown
    note?: unknown
    status?: unknown
    validFrom?: unknown
    validUntil?: unknown
    renewalAt?: unknown
    categoryIds?: unknown
  }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const addOnRequest = await createAdminBusinessAddOnRequest({
      adminId: auth.admin.id,
      businessAccountId: body.body.businessAccountId,
      featureKey: body.body.featureKey,
      note: body.body.note,
      status: body.body.status,
      validFrom: body.body.validFrom,
      validUntil: body.body.validUntil,
      renewalAt: body.body.renewalAt,
      categoryIds: body.body.categoryIds,
    })
    return NextResponse.json({ ok: true, addOnRequest }, { status: 201 })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to add business add-on"))
  }
}
