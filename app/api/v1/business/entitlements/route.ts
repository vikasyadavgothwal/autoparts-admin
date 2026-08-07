import { NextRequest } from "next/server"

import { apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listBusinessEntitlements } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => apiOk({
    entitlements: await listBusinessEntitlements(
      auth.user.id,
      request.nextUrl.searchParams.get("action"),
    ),
  }))
}
