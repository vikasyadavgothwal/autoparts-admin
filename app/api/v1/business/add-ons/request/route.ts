import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { requestBusinessAddOn } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      featureKey?: unknown
      note?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const addOnRequest = await requestBusinessAddOn({
        userId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        featureKey: body.body.featureKey,
        note: body.body.note,
      })
      return apiCreated({ addOnRequest })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to request add-on"))
    }
  })
}
