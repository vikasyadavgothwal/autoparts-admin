import { NextRequest } from "next/server"

import { apiOk, withSupplierApiRoute } from "@/lib/auth/api-guards"
import { getSupplierAnalytics } from "@/services/supplier/supplier-analytics-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) =>
    apiOk({ analytics: await getSupplierAnalytics(user.id) }),
  )
}
