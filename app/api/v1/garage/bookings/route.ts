import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireGarageFromRequest } from "@/lib/parts-mapping/auth"
import {
  createGarageOfflineBooking,
  listGarageBookings,
} from "@/services/garage/garage-booking-service"
import type { GarageOfflineBookingInput } from "@/types/garage/bookings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    bookings: await listGarageBookings(auth.user.id),
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
    const booking = await createGarageOfflineBooking(auth.user.id, parsed.body)
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
