import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { inviteBusinessStaff } from "@/services/business/business-platform-service"

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      firstName?: unknown
      lastName?: unknown
      email?: unknown
      roleIds?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    const businessAccountId =
      typeof body.body.businessAccountId === "string"
        ? body.body.businessAccountId.trim()
        : ""
    if (!businessAccountId) return apiError("Business account id is required")

    try {
      const invitation = await inviteBusinessStaff({
        ownerUserId: auth.user.id,
        businessAccountId,
        firstName: body.body.firstName,
        lastName: body.body.lastName,
        email: body.body.email,
        roleIds: body.body.roleIds,
      })
      return apiCreated({ invitation })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to invite staff"))
    }
  })
}
