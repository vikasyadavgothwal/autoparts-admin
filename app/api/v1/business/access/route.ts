import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { getMyBusinessAccess } from "@/services/business/business-platform-service"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      return apiOk({
        access: await getMyBusinessAccess(auth.user.id),
      })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to load business access"))
    }
  })
}
