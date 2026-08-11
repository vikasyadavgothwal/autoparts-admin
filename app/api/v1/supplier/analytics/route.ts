import { NextRequest } from "next/server"

import { apiOk, withSupplierApiRoute } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessAction } from "@/services/business/business-platform-service"
import { getSupplierAnalytics } from "@/services/supplier/supplier-analytics-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    await assertBusinessAction({
      userId: user.id,
      accountType: BusinessAccountType.Supplier,
      action: "reports.view",
    })
    return apiOk({ analytics: await getSupplierAnalytics(user.id) })
  })
}
