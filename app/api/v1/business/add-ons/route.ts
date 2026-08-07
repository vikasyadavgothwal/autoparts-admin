import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listMyBusinessAddOnRequests } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const addOnRequests = await listMyBusinessAddOnRequests({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ addOnRequests })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list add-on requests"))
    }
  })
}
