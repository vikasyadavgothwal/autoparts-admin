import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  listAdminBusinessAddOnPrices,
  updateAdminBusinessAddOnPrices,
} from "@/services/business/business-platform-service"
import {
  listFeaturedVendorCategoryPrices,
  updateFeaturedVendorCategoryPrices,
} from "@/services/featured-vendor/featured-vendor-category-service"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    prices: await listAdminBusinessAddOnPrices(),
    featuredCategoryPrices: await listFeaturedVendorCategoryPrices(),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{ prices?: unknown; featuredCategoryPrices?: unknown }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const prices = await updateAdminBusinessAddOnPrices({ prices: body.body.prices })
    const featuredCategoryPrices = body.body.featuredCategoryPrices === undefined
      ? await listFeaturedVendorCategoryPrices()
      : await updateFeaturedVendorCategoryPrices({ prices: body.body.featuredCategoryPrices })
    return NextResponse.json({ ok: true, prices, featuredCategoryPrices })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update add-on prices"))
  }
}
