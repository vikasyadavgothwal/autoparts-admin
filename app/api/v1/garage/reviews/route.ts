import { NextRequest } from "next/server"

import { apiOk, withGarageApiRoute } from "@/lib/auth/api-guards"
import {
  listGarageServiceReviews,
  listGarageServiceReviewsPage,
} from "@/services/garage/garage-review-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withGarageApiRoute(request, async (user) => {
    if (request.nextUrl.searchParams.get("all") === "1") {
      return apiOk({ reviews: await listGarageServiceReviews(user.id) })
    }
    const result = await listGarageServiceReviewsPage(user.id, {
      page: request.nextUrl.searchParams.get("page"),
      pageSize: request.nextUrl.searchParams.get("pageSize"),
    })
    return apiOk({ reviews: result.items, pagination: result.pagination })
  })
}
