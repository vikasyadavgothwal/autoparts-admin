import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  completeGarageBookingByAdmin,
  type GarageBookingAdminCompletionOverrideInput,
} from "@/services/admin-dashboard/garages/garage-management-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageBookingAdminCompletionOverrideInput>(request)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
  }

  try {
    const booking = await completeGarageBookingByAdmin(
      auth.admin.id,
      (await context.params).id,
      parsed.body,
    )
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to complete booking by Admin override",
      },
      { status: 400 },
    )
  }
}
