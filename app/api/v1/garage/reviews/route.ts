import { NextRequest } from "next/server"

import { apiOk, withGarageApiRoute } from "@/lib/auth/api-guards"
import { listGarageServiceReviews } from "@/services/garage/garage-review-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withGarageApiRoute(request, async (user) =>
    apiOk({ reviews: await listGarageServiceReviews(user.id) }),
  )
}
