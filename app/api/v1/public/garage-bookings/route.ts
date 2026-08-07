import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/auth/api-guards"
import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import {
  createPublicGarageBooking,
  getPublicGarageBookingAvailability,
} from "@/services/garage/garage-booking-service"
import type { GarageBookingInput } from "@/types/garage/bookings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      ...(await getPublicGarageBookingAvailability({
        garageId: request.nextUrl.searchParams.get("garageId") ?? "",
        serviceId: request.nextUrl.searchParams.get("serviceId") ?? "",
        bookingDate: request.nextUrl.searchParams.get("bookingDate") ?? "",
      })),
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to load availability" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const auth = await requireUserAuth(accessToken)

  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Login is required before booking a service" },
      { status: 401 },
    )
  }

  if (!auth.user.roles.includes("User")) {
    return NextResponse.json(
      { ok: false, message: "A user account is required to book a service" },
      { status: 403 },
    )
  }

  const parsed = await readJsonBody<GarageBookingInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const result = await createPublicGarageBooking(auth.user, parsed.body)
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to create booking",
      },
      { status: 400 },
    )
  }
}
