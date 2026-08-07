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
  createBusinessSavedSearch,
  listBusinessSavedSearches,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const savedSearches = await listBusinessSavedSearches({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        scope: request.nextUrl.searchParams.get("scope"),
      })
      return apiOk({ savedSearches })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list saved searches"))
    }
  })
}

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      name?: unknown
      scope?: unknown
      query?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const savedSearch = await createBusinessSavedSearch({
        userId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        name: body.body.name,
        scope: body.body.scope,
        query: body.body.query,
      })
      return apiCreated({ savedSearch })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to save search"))
    }
  })
}
