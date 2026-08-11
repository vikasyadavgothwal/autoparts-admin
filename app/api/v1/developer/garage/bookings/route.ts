import { NextRequest } from "next/server"

import { apiCreated, apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { assertBusinessPlanLimit, logBusinessActivity } from "@/services/business/business-platform-service"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { createGarageOfflineBooking, listGarageBookings } from "@/services/garage/garage-booking-service"
import type { GarageOfflineBookingInput } from "@/types/garage/bookings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.bookings.read")
  if (!auth.ok) return auth.response
  return apiOk({ bookings: await listGarageBookings(auth.context.ownerUserId) })
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Garage, "garage.bookings.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<GarageOfflineBookingInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const currentCount = await db.garageBooking.count({ where: { garageId: auth.context.ownerUserId } })
    await assertBusinessPlanLimit({
      userId: auth.context.ownerUserId,
      accountType: BusinessAccountType.Garage,
      limit: "appointmentLimit",
      currentCount,
    })
    const booking = await createGarageOfflineBooking(auth.context.ownerUserId, parsed.body)
    await logBusinessActivity({
      businessAccountId: auth.context.businessAccountId,
      actorUserId: auth.context.ownerUserId,
      action: "developer_api.garage_booking.created",
      entityType: "garage_booking",
      entityId: booking.id,
      metadata: { apiKeyId: auth.context.apiKeyId },
    })
    return apiCreated({ booking })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to add booking"))
  }
}
