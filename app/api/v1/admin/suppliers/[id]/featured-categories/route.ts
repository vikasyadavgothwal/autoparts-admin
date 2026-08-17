import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  featuredCategorySource,
  listSupplierFeaturedCategoryOptions,
  setSupplierFeaturedCategories,
} from "@/services/featured-vendor/featured-vendor-category-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  try {
    return apiOk(await listSupplierFeaturedCategoryOptions((await context.params).id))
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to load featured categories"))
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{ categoryIds?: unknown; validUntil?: unknown }>(request)
  if (!body.ok) return apiError(body.message)
  const validUntil = typeof body.body.validUntil === "string" || body.body.validUntil === null
    ? body.body.validUntil
    : undefined

  try {
    return apiOk(await setSupplierFeaturedCategories({
      supplierId: (await context.params).id,
      categoryIds: body.body.categoryIds,
      source: featuredCategorySource.admin,
      assignedByAdminId: auth.admin.id,
      validUntil: validUntil ?? null,
    }))
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update featured categories"))
  }
}
