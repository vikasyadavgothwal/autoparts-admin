import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { updateGarageBookingStatus } from "@/services/garage/garage-booking-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.bookings.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<{ status?: unknown; completionOtp?: unknown }>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const booking = await updateGarageBookingStatus(
      auth.context.ownerUserId,
      (await context.params).id,
      parsed.body.status,
      { completionOtp: parsed.body.completionOtp },
    )
    return apiOk({ booking })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update booking"))
  }
}
