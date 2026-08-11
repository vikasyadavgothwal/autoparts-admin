import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, requireUserFromRequest } from "@/lib/auth/api-guards"
import { revokeBusinessApiKey } from "@/services/business/business-api-key-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireUserFromRequest(request)
  if (!auth.ok) return auth.response
  try {
    const { id } = await context.params
    return apiOk({
      apiKey: await revokeBusinessApiKey({
        userId: auth.auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        keyId: id,
      }),
    })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to revoke API key"))
  }
}
