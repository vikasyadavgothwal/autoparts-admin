import { NextRequest } from "next/server"

import { apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { getMyBusinessAccess } from "@/services/business/business-platform-service"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => apiOk({
    access: await getMyBusinessAccess(auth.user.id),
  }))
}
