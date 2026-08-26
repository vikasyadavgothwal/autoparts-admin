import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withGarageApiRoute } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessMenuAccess } from "@/services/business/business-platform-service"
import {
  listGarageServiceReviews,
  listGarageServiceReviewsPage,
} from "@/services/garage/garage-review-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withGarageApiRoute(request, async (user) => {
    let garageId = user.id
    try {
      const account = await assertBusinessMenuAccess({ userId: user.id, accountType: BusinessAccountType.Garage, menuKey: "reviews" })
      garageId = account.ownerUserId
    } catch (error) {
      return apiError(apiErrorMessage(error, "You do not have permission to view reviews"), 403)
    }
    if (request.nextUrl.searchParams.get("all") === "1") {
      return apiOk({ reviews: await listGarageServiceReviews(garageId) })
    }
    const result = await listGarageServiceReviewsPage(garageId, {
      page: request.nextUrl.searchParams.get("page"),
      pageSize: request.nextUrl.searchParams.get("pageSize"),
    })
    return apiOk({ reviews: result.items, pagination: result.pagination })
  })
}
