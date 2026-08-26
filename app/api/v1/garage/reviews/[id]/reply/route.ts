import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withGarageApiRoute,
} from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { updateGarageServiceReviewReply } from "@/services/garage/garage-review-service"
import type { GarageReviewReplyInput } from "@/types/garage/reviews"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withGarageApiRoute(request, async (user) => {
    const parsed = await readJsonBody<GarageReviewReplyInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const garageId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Garage)
      const review = await updateGarageServiceReviewReply(
        garageId,
        (await context.params).id,
        parsed.body,
      )
      return apiOk({ review })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update reply"))
    }
  })
}
