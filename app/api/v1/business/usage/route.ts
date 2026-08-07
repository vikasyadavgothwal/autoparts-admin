import { NextRequest } from "next/server"

import { apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listBusinessUsage } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => apiOk({
    usage: await listBusinessUsage(auth.user.id),
  }))
}
