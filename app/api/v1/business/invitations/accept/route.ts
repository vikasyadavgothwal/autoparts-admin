import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { acceptBusinessInvitation } from "@/services/business/business-platform-service"

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{ invitationToken?: unknown }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const invitation = await acceptBusinessInvitation({
        userId: auth.user.id,
        userEmail: auth.user.email,
        invitationToken: body.body.invitationToken,
      })
      return apiOk({ invitation })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to accept invitation"))
    }
  })
}
