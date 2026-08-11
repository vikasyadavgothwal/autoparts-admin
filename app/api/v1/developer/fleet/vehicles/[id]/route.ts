import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, isUniqueConstraintError, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { deleteFleetVehicle, updateFleetVehicle } from "@/services/fleet/fleet-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, "fleet.vehicles.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<FleetVehicleInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const vehicle = await updateFleetVehicle(auth.context.ownerUserId, (await context.params).id, parsed.body)
    return apiOk({ vehicle })
  } catch (error) {
    return apiError(isUniqueConstraintError(error) ? "A vehicle with this VIN already exists in your fleet" : apiErrorMessage(error, "Unable to update vehicle"))
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, "fleet.vehicles.write")
  if (!auth.ok) return auth.response
  try {
    return apiOk(await deleteFleetVehicle(auth.context.ownerUserId, (await context.params).id))
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to delete vehicle"))
  }
}
