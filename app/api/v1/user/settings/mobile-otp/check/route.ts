import { NextRequest, NextResponse } from "next/server"

import {
  readJsonBody,
  requireCustomerUserFromRequest,
} from "@/lib/parts-mapping/auth"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"

type CheckBody = { phone?: unknown }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<CheckBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    await assertMobileNumberAvailable(
      auth.user.id,
      typeof parsed.body.phone === "string" ? parsed.body.phone : "",
    )
    return NextResponse.json({ ok: true, message: "Mobile number is available" })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to check mobile number",
      },
      { status: 400 },
    )
  }
}
