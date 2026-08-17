import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listMyBusinessAddOnRequests, listMyFeaturedVendorAddOnPlacements } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const businessAccountId = request.nextUrl.searchParams.get("businessAccountId")
      const [addOnRequests, featuredVendorPlacements] = await Promise.all([
        listMyBusinessAddOnRequests({ userId: auth.user.id, businessAccountId }),
        listMyFeaturedVendorAddOnPlacements({ userId: auth.user.id, businessAccountId }),
      ])
      return apiOk({ addOnRequests, featuredVendorPlacements })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list add-on requests"))
    }
  })
}
