import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireGarageFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"

type CheckBody = { phone?: unknown }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<CheckBody>(request)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
  }

  try {
    const garageId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Garage)
    if (garageId !== auth.user.id) {
      return NextResponse.json(
        { ok: false, message: "Only the garage owner can update workspace settings" },
        { status: 403 },
      )
    }
    await assertMobileNumberAvailable(
      garageId,
      typeof parsed.body.phone === "string" ? parsed.body.phone : "",
    )
    return NextResponse.json({ ok: true, message: "Mobile number is available" })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to check mobile number" },
      { status: 400 },
    )
  }
}
