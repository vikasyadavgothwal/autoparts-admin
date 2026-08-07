import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import {
  createBusinessRole,
  listBusinessRoles,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const roles = await listBusinessRoles({
        ownerUserId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ roles })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list roles"))
    }
  })
}

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      name?: unknown
      description?: unknown
      permissionIds?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    const businessAccountId =
      typeof body.body.businessAccountId === "string"
        ? body.body.businessAccountId.trim()
        : ""
    if (!businessAccountId) return apiError("Business account id is required")

    try {
      const role = await createBusinessRole({
        ownerUserId: auth.user.id,
        businessAccountId,
        name: body.body.name,
        description: body.body.description,
        permissionIds: body.body.permissionIds,
      })
      return apiCreated({ role })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to create role"))
    }
  })
}
