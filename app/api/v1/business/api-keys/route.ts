import { NextRequest } from "next/server"

import { apiCreated, apiError, apiErrorMessage, apiOk, readJsonBody, requireUserFromRequest } from "@/lib/auth/api-guards"
import { createBusinessApiKey, listBusinessApiKeys } from "@/services/business/business-api-key-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireUserFromRequest(request)
  if (!auth.ok) return auth.response
  try {
    return apiOk(await listBusinessApiKeys({
      userId: auth.auth.user.id,
      businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
    }))
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to load API keys"))
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserFromRequest(request)
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<{ businessAccountId?: unknown; name?: unknown; scopes?: unknown }>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    return apiCreated(await createBusinessApiKey({
      userId: auth.auth.user.id,
      businessAccountId: parsed.body.businessAccountId,
      name: parsed.body.name,
      scopes: parsed.body.scopes,
    }))
  } catch (error) {
    const status = error instanceof Error && error.name === "API_BILLING_REQUIRED" ? 402 : 400
    return apiError(apiErrorMessage(error, "Unable to create API key"), status)
  }
}
