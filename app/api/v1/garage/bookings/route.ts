import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireGarageFromRequest } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  assertBusinessPlanLimit,
  getMyBusinessAccess,
  logBusinessActivity,
} from "@/services/business/business-platform-service"
import {
  createGarageOfflineBooking,
  listGarageBookings,
  listGarageBookingsPage,
} from "@/services/garage/garage-booking-service"
import type { GarageOfflineBookingInput } from "@/types/garage/bookings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  if (request.nextUrl.searchParams.get("all") === "1") {
    return NextResponse.json({
      ok: true,
      bookings: await listGarageBookings(auth.user.id),
    })
  }

  const result = await listGarageBookingsPage(auth.user.id, {
    page: request.nextUrl.searchParams.get("page"),
    pageSize: request.nextUrl.searchParams.get("pageSize"),
  })

  return NextResponse.json({
    ok: true,
    bookings: result.items,
    pagination: result.pagination,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageOfflineBookingInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const access = (await getMyBusinessAccess(auth.user.id)).find(
      (item) => item.businessAccount.type === BusinessAccountType.Garage,
    )
    const appointmentAction = access?.actions["appointments.create"]
    if (!appointmentAction?.allowed) {
      return NextResponse.json(
        {
          ok: false,
          message:
            appointmentAction?.reason ||
            "Your current plan or role cannot add appointments",
        },
        { status: 403 },
      )
    }
    const garageId = access?.businessAccount.ownerUserId ?? auth.user.id
    const currentCount = await db.garageBooking.count({
      where: { garageId },
    })
    const account = await assertBusinessPlanLimit({
      userId: auth.user.id,
      accountType: BusinessAccountType.Garage,
      limit: "appointmentLimit",
      currentCount,
    })
    const booking = await createGarageOfflineBooking(garageId, parsed.body)
    await logBusinessActivity({
      businessAccountId: account.id,
      actorUserId: auth.user.id,
      action: "garage_booking.created",
      entityType: "garage_booking",
      entityId: booking.id,
      metadata: {
        garageId,
        createdByUserId: auth.user.id,
      },
    })
    return NextResponse.json({ ok: true, booking }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to add appointment",
      },
      { status: 400 },
    )
  }
}
