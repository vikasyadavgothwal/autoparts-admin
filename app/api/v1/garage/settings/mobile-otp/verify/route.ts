import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import {
  verifyGarageMobileOtp,
  verifyGarageMobileWithFirebase,
} from "@/services/garage/garage-settings-service"

type VerifyOtpBody = {
  firebaseIdToken?: unknown
  otp?: unknown
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<VerifyOtpBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const firebaseIdToken =
      typeof parsed.body.firebaseIdToken === "string"
        ? parsed.body.firebaseIdToken
        : ""
    return NextResponse.json({
      ok: true,
      profile: firebaseIdToken
        ? await verifyGarageMobileWithFirebase(auth.user.id, firebaseIdToken)
        : await verifyGarageMobileOtp(
            auth.user.id,
            typeof parsed.body.otp === "string" ? parsed.body.otp : "",
          ),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to verify OTP",
      },
      { status: 400 },
    )
  }
}
