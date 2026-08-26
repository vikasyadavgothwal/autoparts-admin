import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody, withSupplierApiRoute } from "@/lib/auth/api-guards"
import {
  featuredCategorySource,
  listSupplierFeaturedCategoryOptions,
  setSupplierFeaturedCategories,
} from "@/services/featured-vendor/featured-vendor-category-service"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

const listPlanAllowedCategoryIds = (planId: string) =>
  db.$queryRaw<Array<{ categoryId: string }>>`
    SELECT "categoryId" FROM "plan_featured_vendor_categories" WHERE "planId" = ${planId}
  `

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    try {
      const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier)
      const account = await db.businessAccount.findFirst({
        where: { ownerUserId: supplierId, type: BusinessAccountType.Supplier, isActive: true },
        include: { plan: true },
      })
      const usePlanAllowedCategories = request.nextUrl.searchParams.get("scope") !== "add-on"
      const allowedRows = account && usePlanAllowedCategories ? await listPlanAllowedCategoryIds(account.plan.id) : []
      return apiOk(await listSupplierFeaturedCategoryOptions(supplierId, {
        allowedCategoryIds: account && usePlanAllowedCategories ? allowedRows.map((row) => row.categoryId) : undefined,
        excludeActiveCategories: !usePlanAllowedCategories,
        planFeatured: Boolean(account?.plan.featuredVendor),
      }))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to load featured categories"))
    }
  })
}

export async function PUT(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const body = await readJsonBody<{ categoryIds?: unknown }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier)
      const account = await db.businessAccount.findFirst({
        where: { ownerUserId: supplierId, type: BusinessAccountType.Supplier, isActive: true },
        include: { plan: true },
      })
      if (!account?.plan.featuredVendor) throw new Error("Featured Vendor is not included in your current plan")
      const allowedRows = await listPlanAllowedCategoryIds(account.plan.id)

      return apiOk(await setSupplierFeaturedCategories({
        supplierId,
        categoryIds: body.body.categoryIds,
        source: featuredCategorySource.plan,
        businessAccountId: account.id,
        maxCategories: account.plan.featuredVendorCategoryLimit,
        allowedCategoryIds: allowedRows.map((row) => row.categoryId),
      }))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update featured categories"))
    }
  })
}
