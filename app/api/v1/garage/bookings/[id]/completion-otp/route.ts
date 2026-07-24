import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/parts-mapping/auth"
import { requestGarageBookingCompletionOtp } from "@/services/garage/garage-booking-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const result = await requestGarageBookingCompletionOtp(
      auth.user.id,
      (await context.params).id,
    )
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to send completion OTP",
      },
      { status: 400 },
    )
  }
}
