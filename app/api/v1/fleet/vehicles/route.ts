import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  isUniqueConstraintError,
  readJsonBody,
  withFleetApiRoute,
} from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  assertBusinessPlanLimit,
  logBusinessActivity,
} from "@/services/business/business-platform-service"
import { createFleetVehicle, listFleetVehicles } from "@/services/fleet/fleet-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withFleetApiRoute(request, async (user) => {
    const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
    const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
    return apiOk(await listFleetVehicles(user.id, page, pageSize))
  })
}

export async function POST(request: NextRequest) {
  return withFleetApiRoute(request, async (user) => {
    const parsed = await readJsonBody<FleetVehicleInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const currentCount = await db.fleetVehicle.count({ where: { fleetId: user.id, status: { not: "plan_suspended" } } })
      const account = await assertBusinessPlanLimit({
        userId: user.id,
        accountType: BusinessAccountType.Fleet,
        limit: "vehicleLimit",
        currentCount,
      })
      const vehicle = await createFleetVehicle(user.id, parsed.body)
      await logBusinessActivity({
        businessAccountId: account.id,
        actorUserId: user.id,
        action: "fleet_vehicle.created",
        entityType: "fleet_vehicle",
        entityId: vehicle.id,
      })
      return apiCreated({ vehicle })
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? "A vehicle with this VIN already exists in your fleet"
        : apiErrorMessage(error, "Unable to add vehicle")
      return apiError(message)
    }
  })
}
