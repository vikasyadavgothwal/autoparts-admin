import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { getDeveloperProfile, updateDeveloperProfile } from "@/services/business/developer-profile-service"
import { logBusinessActivity } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

const authenticate = async (request: NextRequest, scope: "account.profile.read" | "account.profile.write") => {
  const garageAuth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, scope)
  if (garageAuth.ok) return garageAuth
  const fleetAuth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, scope)
  if (fleetAuth.ok) return fleetAuth
  return requireDeveloperApiKey(request, BusinessAccountType.Supplier, scope)
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request, "account.profile.read")
  if (!auth.ok) return auth.response
  return apiOk({
    account: auth.context,
    profile: await getDeveloperProfile(auth.context.accountType, auth.context.ownerUserId),
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request, "account.profile.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<Record<string, unknown>>(request)
  if (!parsed.ok) return apiError(parsed.message)

  try {
    const profile = await updateDeveloperProfile(
      auth.context.accountType,
      auth.context.ownerUserId,
      parsed.body,
    )
    await logBusinessActivity({
      businessAccountId: auth.context.businessAccountId,
      actorUserId: auth.context.ownerUserId,
      action: "developer_api.profile.updated",
      entityType: "business_profile",
      entityId: auth.context.ownerUserId,
      metadata: { apiKeyId: auth.context.apiKeyId },
    })
    return apiOk({ account: auth.context, profile })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update business profile"))
  }
}
