import { NextRequest, NextResponse } from "next/server"

import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { scheduleUserGarageBookingSlot } from "@/services/garage/garage-booking-service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const auth = await requireUserAuth(accessToken)

  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    )
  }

  if (!auth.user.roles.includes("User")) {
    return NextResponse.json(
      { ok: false, message: "User role is required" },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    bookingDate?: unknown
    bookingTime?: unknown
  }

  try {
    const booking = await scheduleUserGarageBookingSlot(auth.user.id, id, body)
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to schedule booking",
      },
      { status: 400 },
    )
  }
}
