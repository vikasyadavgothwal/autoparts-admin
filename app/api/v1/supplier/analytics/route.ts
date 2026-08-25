import { NextRequest } from "next/server"

import { apiError, apiOk, withSupplierApiRoute } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId, getMyBusinessAccess } from "@/services/business/business-platform-service"
import { getSupplierAnalytics } from "@/services/supplier/supplier-analytics-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const scope = request.nextUrl.searchParams.get("scope") === "dashboard"
      ? "dashboard"
      : "performance"
    const access = (await getMyBusinessAccess(user.id)).find(
      (item) => item.businessAccount.type === BusinessAccountType.Supplier,
    )
    if (!access) return apiError("Supplier business access is required", 403)
    if (scope === "dashboard") {
      const hasOperationalMenu = ["inventory", "rfq-inbox", "orders", "offers", "reviews", "performance"].some((menu) =>
        access.visibleMenus.includes(menu),
      )
      if (!access.businessAccount.isOwner && !hasOperationalMenu) {
        return apiError("You do not have permission to view the supplier dashboard", 403)
      }
    } else {
      const canViewPerformance =
        access.businessAccount.isOwner ||
        access.visibleMenus.includes("performance") ||
        access.actions["reports.view"]?.allowed

      if (!canViewPerformance) {
        return apiError("You do not have permission to view supplier performance", 403)
      }
    }
    const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier)
    return apiOk({ analytics: await getSupplierAnalytics(supplierId) })
  })
}
