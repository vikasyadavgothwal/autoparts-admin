import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listBusinessSupportContent } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const support = await listBusinessSupportContent({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ support })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to load support content"))
    }
  })
}
