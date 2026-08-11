import { NextRequest } from "next/server"

import { apiCreated, apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessPlanLimit, logBusinessActivity } from "@/services/business/business-platform-service"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { createGarageService, listGarageServices } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.services.read")
  if (!auth.ok) return auth.response
  return apiOk({ services: await listGarageServices(auth.context.ownerUserId) })
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.services.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<GarageServiceInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const currentCount = await db.garageService.count({ where: { garageId: auth.context.ownerUserId, status: "active" } })
    await assertBusinessPlanLimit({
      userId: auth.context.ownerUserId,
      accountType: BusinessAccountType.Garage,
      limit: "serviceLimit",
      currentCount,
    })
    const service = await createGarageService(auth.context.ownerUserId, parsed.body)
    await logBusinessActivity({
      businessAccountId: auth.context.businessAccountId,
      actorUserId: auth.context.ownerUserId,
      action: "developer_api.garage_service.created",
      entityType: "garage_service",
      entityId: service.id,
      metadata: { apiKeyId: auth.context.apiKeyId },
    })
    return apiCreated({ service })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to add service"))
  }
}
