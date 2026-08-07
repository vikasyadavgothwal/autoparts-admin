import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import {
  getCurrentUserAccount,
  updateCurrentUserAccount,
} from "@/services/user-auth/user-auth-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) =>
    apiOk({ account: await getCurrentUserAccount(auth.user.id) }),
  )
}

export async function PATCH(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      firstName?: unknown
      lastName?: unknown
      email?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const account = await updateCurrentUserAccount({
        userId: auth.user.id,
        firstName: body.body.firstName,
        lastName: body.body.lastName,
        email: body.body.email,
      })
      return apiOk({ account })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update account"))
    }
  })
}
