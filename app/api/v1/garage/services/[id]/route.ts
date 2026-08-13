import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withGarageApiRoute,
} from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getMyBusinessAccess, reconcileGarageServicePlan } from "@/services/business/business-platform-service"
import { deleteGarageService, listGarageServices, updateGarageService } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

async function getGarageIdForUser(userId: string) {
  const account = await db.businessAccount.findFirst({
    where: {
      type: BusinessAccountType.Garage,
      isActive: true,
      members: {
        some: {
          userId,
          status: "Active",
        },
      },
    },
    select: { ownerUserId: true },
  })
  return account?.ownerUserId ?? userId
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withGarageApiRoute(request, async (user) => {
    const parsed = await readJsonBody<GarageServiceInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const access = (await getMyBusinessAccess(user.id)).find(
        (item) => item.businessAccount.type === BusinessAccountType.Garage,
      )
      const serviceAction = access?.actions["services.update"]
      if (!serviceAction?.allowed) {
        return apiError(
          serviceAction?.reason || "Your current plan or role cannot update services",
          403,
        )
      }
      const garageId = await getGarageIdForUser(user.id)
      const service = await updateGarageService(
        garageId,
        (await context.params).id,
        parsed.body,
      )
      await reconcileGarageServicePlan(garageId)
      return apiOk({ service, services: await listGarageServices(garageId) })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update service"))
    }
  })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withGarageApiRoute(request, async (user) => {
    try {
      const access = (await getMyBusinessAccess(user.id)).find(
        (item) => item.businessAccount.type === BusinessAccountType.Garage,
      )
      const serviceAction = access?.actions["services.delete"]
      if (!serviceAction?.allowed) {
        return apiError(
          serviceAction?.reason || "Your current plan or role cannot delete services",
          403,
        )
      }
      const garageId = await getGarageIdForUser(user.id)
      const deleted = await deleteGarageService(garageId, (await context.params).id)
      await reconcileGarageServicePlan(garageId)
      return apiOk({ ...deleted, services: await listGarageServices(garageId) })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete service"))
    }
  })
}
