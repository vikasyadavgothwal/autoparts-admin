import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import {
  deleteBusinessRole,
  updateBusinessRole,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      name?: unknown
      description?: unknown
      permissionIds?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const { id } = await context.params
      const role = await updateBusinessRole({
        ownerUserId: auth.user.id,
        roleId: id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        name: body.body.name,
        description: body.body.description,
        permissionIds: body.body.permissionIds,
      })
      return apiOk({ role })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update role"))
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
      const result = await deleteBusinessRole({
        ownerUserId: auth.user.id,
        roleId: id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk(result)
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete role"))
    }
  })
}
