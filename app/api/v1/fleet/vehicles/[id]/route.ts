import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  isUniqueConstraintError,
  readJsonBody,
  withFleetApiRoute,
} from "@/lib/auth/api-guards"
import {
  deleteFleetVehicle,
  updateFleetVehicle,
} from "@/services/fleet/fleet-service"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessAction } from "@/services/business/business-platform-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withFleetApiRoute(request, async (user) => {
    const parsed = await readJsonBody<FleetVehicleInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      await assertBusinessAction({
        userId: user.id,
        accountType: BusinessAccountType.Fleet,
        action: "vehicles.update",
      })
      const vehicle = await updateFleetVehicle(
        user.id,
        (await context.params).id,
        parsed.body,
      )
      return apiOk({ vehicle })
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? "A vehicle with this VIN already exists in your fleet"
        : apiErrorMessage(error, "Unable to update vehicle")
      return apiError(message)
    }
  })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withFleetApiRoute(request, async (user) => {
    try {
      await assertBusinessAction({
        userId: user.id,
        accountType: BusinessAccountType.Fleet,
        action: "vehicles.delete",
      })
      return apiOk(await deleteFleetVehicle(user.id, (await context.params).id))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete vehicle"))
    }
  })
}
