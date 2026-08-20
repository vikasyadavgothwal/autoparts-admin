import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { changeBusinessAccountPlan } from "@/services/business/business-platform-service"

export async function PATCH(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      planId?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      return apiOk(await changeBusinessAccountPlan({
        ownerUserId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        planId: body.body.planId,
      }))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to change plan"))
    }
  })
}
