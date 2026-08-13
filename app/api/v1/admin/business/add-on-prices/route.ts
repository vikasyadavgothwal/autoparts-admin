import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  listAdminBusinessAddOnPrices,
  updateAdminBusinessAddOnPrices,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    prices: await listAdminBusinessAddOnPrices(),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{ prices?: unknown }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const prices = await updateAdminBusinessAddOnPrices({ prices: body.body.prices })
    return NextResponse.json({ ok: true, prices })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update add-on prices"))
  }
}
