import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { listBusinessPermissions } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const permissions = await listBusinessPermissions({
        ownerUserId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ permissions })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list permissions"))
    }
  })
}
