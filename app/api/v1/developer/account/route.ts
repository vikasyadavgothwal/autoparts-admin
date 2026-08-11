import { NextRequest } from "next/server"

import { apiOk } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const garageAuth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.services.read")
  if (garageAuth.ok) return apiOk({ account: garageAuth.context })
  const fleetAuth = await requireDeveloperApiKey(request, BusinessAccountType.Fleet, "fleet.vehicles.read")
  if (fleetAuth.ok) return apiOk({ account: fleetAuth.context })
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Supplier, "supplier.inventory.read")
  if (!auth.ok) return auth.response
  return apiOk({ account: auth.context })
}
