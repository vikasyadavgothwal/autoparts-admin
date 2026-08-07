import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import {
  deleteBusinessMember,
  setBusinessMemberStatus,
  setBusinessMemberRoleIds,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      roleIds?: unknown
      status?: unknown
      firstName?: unknown
      lastName?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const { id } = await context.params
      if (body.body.status !== undefined) {
        const member = await setBusinessMemberStatus({
          ownerUserId: auth.user.id,
          memberId: id,
          businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
          status: body.body.status,
        })
        return apiOk({ member })
      }
      const member = await setBusinessMemberRoleIds({
        ownerUserId: auth.user.id,
        memberId: id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        firstName: body.body.firstName,
        lastName: body.body.lastName,
        roleIds: body.body.roleIds,
      })
      return apiOk({ member })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update member roles"))
    }
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const { id } = await context.params
      const member = await deleteBusinessMember({
        ownerUserId: auth.user.id,
        memberId: id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ member })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete member"))
    }
  })
}
