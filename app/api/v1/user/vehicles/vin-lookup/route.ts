import { NextRequest } from "next/server"

import {
  apiError,
  apiOk,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import { resolveVehicleVins } from "@/services/fleet/rfq-import-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async () => {
    const vin = request.nextUrl.searchParams.get("vin")?.trim().toUpperCase() ?? ""
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return apiError("Enter a valid 17-character VIN")
    }

    try {
      const [vehicle] = await resolveVehicleVins([vin])
      return apiOk({ found: true, vehicle })
    } catch (error) {
      const message = error instanceof Error ? error.message : "VIN lookup failed"
      if (message.startsWith("We could not find these VINs:")) {
        return apiOk({ found: false, message: "We could not find this VIN in our database or VIN provider. Check and correct the VIN." })
      }
      return apiError(message, 503)
    }
  })
}
