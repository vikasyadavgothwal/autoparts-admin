import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withGarageApiRoute,
} from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  assertBusinessPlanLimit,
  getMyBusinessAccess,
  logBusinessActivity,
  reconcileGarageServicePlan,
} from "@/services/business/business-platform-service"
import { createGarageService, listGarageServices } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

export const dynamic = "force-dynamic"

async function getGarageBusinessAccount(userId: string) {
  return db.businessAccount.findFirst({
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
    select: { id: true, ownerUserId: true },
  })
}

export async function GET(request: NextRequest) {
  return withGarageApiRoute(request, async (user) => {
    const account = await getGarageBusinessAccount(user.id)
    await reconcileGarageServicePlan(account?.ownerUserId ?? user.id)
    return apiOk({ services: await listGarageServices(account?.ownerUserId ?? user.id) })
  })
}

export async function POST(request: NextRequest) {
  return withGarageApiRoute(request, async (user) => {
    const parsed = await readJsonBody<GarageServiceInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const access = (await getMyBusinessAccess(user.id)).find(
        (item) => item.businessAccount.type === BusinessAccountType.Garage,
      )
      const serviceAction = access?.actions["services.create"]
      if (!serviceAction?.allowed) {
        return apiError(
          serviceAction?.reason || "Your current plan or role cannot add services",
          403,
        )
      }
      const accessAccount = await getGarageBusinessAccount(user.id)
      const garageId = accessAccount?.ownerUserId ?? user.id
      await reconcileGarageServicePlan(garageId)
      const currentCount = await db.garageService.count({
        where: { garageId, status: "active" },
      })
      const account = await assertBusinessPlanLimit({
        userId: user.id,
        accountType: BusinessAccountType.Garage,
        limit: "serviceLimit",
        currentCount,
      })
      const service = await createGarageService(account.ownerUserId, parsed.body)
      await logBusinessActivity({
        businessAccountId: account.id,
        actorUserId: user.id,
        action: "garage_service.created",
        entityType: "garage_service",
        entityId: service.id,
        metadata: {
          garageId: account.ownerUserId,
          createdByUserId: user.id,
        },
      })
      return apiCreated({ service, services: await listGarageServices(account.ownerUserId) })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to add service"))
    }
  })
}
