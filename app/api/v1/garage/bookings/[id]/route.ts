import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireGarageFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { updateGarageBookingStatus } from "@/services/garage/garage-booking-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<{
    status?: unknown;
    completionOtp?: unknown;
    cancellationReason?: unknown;
  }>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const garageId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Garage)
    const booking = await updateGarageBookingStatus(
      garageId,
      (await context.params).id,
      parsed.body.status,
      {
        completionOtp: parsed.body.completionOtp,
        cancellationReason: parsed.body.cancellationReason,
      },
    )
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update booking",
      },
      { status: 400 },
    )
  }
}
