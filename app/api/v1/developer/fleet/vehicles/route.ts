import { NextRequest } from "next/server"

import { apiCreated, apiError, apiErrorMessage, apiOk, isUniqueConstraintError, readJsonBody } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessPlanLimit, logBusinessActivity } from "@/services/business/business-platform-service"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { createFleetVehicle, listFleetVehicles } from "@/services/fleet/fleet-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, "fleet.vehicles.read")
  if (!auth.ok) return auth.response
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
  return apiOk(await listFleetVehicles(auth.context.ownerUserId, page, pageSize))
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, "fleet.vehicles.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<FleetVehicleInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const currentCount = await db.fleetVehicle.count({ where: { fleetId: auth.context.ownerUserId, status: { not: "plan_suspended" } } })
    await assertBusinessPlanLimit({
      userId: auth.context.ownerUserId,
      accountType: BusinessAccountType.Fleet,
      limit: "vehicleLimit",
      currentCount,
    })
    const vehicle = await createFleetVehicle(auth.context.ownerUserId, parsed.body)
    await logBusinessActivity({
      businessAccountId: auth.context.businessAccountId,
      actorUserId: auth.context.ownerUserId,
      action: "developer_api.fleet_vehicle.created",
      entityType: "fleet_vehicle",
      entityId: vehicle.id,
      metadata: { apiKeyId: auth.context.apiKeyId },
    })
    return apiCreated({ vehicle })
  } catch (error) {
    return apiError(isUniqueConstraintError(error) ? "A vehicle with this VIN already exists in your fleet" : apiErrorMessage(error, "Unable to add vehicle"))
  }
}
