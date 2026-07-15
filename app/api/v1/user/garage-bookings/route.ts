import { NextRequest, NextResponse } from "next/server"

import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { listUserGarageBookings } from "@/services/garage/garage-booking-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    ok: true,
    bookings: await listUserGarageBookings(auth.user.id),
  })
}
