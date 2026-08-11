import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { deleteGarageService, updateGarageService } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.services.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<GarageServiceInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const service = await updateGarageService(auth.context.ownerUserId, (await context.params).id, parsed.body)
    return apiOk({ service })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update service"))
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.services.write")
  if (!auth.ok) return auth.response
  try {
    return apiOk(await deleteGarageService(auth.context.ownerUserId, (await context.params).id))
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to delete service"))
  }
}
