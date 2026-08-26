import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { verifyFleetMobileWithFirebase } from "@/services/fleet/fleet-settings-service"

type VerifyOtpBody = {
  firebaseIdToken?: unknown
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
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
    if (!firebaseIdToken) {
      return NextResponse.json(
        { ok: false, message: "Firebase ID token is required" },
        { status: 400 },
      )
    }

    const fleetId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
    if (fleetId !== auth.user.id) {
      return NextResponse.json(
        { ok: false, message: "Only the fleet owner can update workspace settings" },
        { status: 403 },
      )
    }
    return NextResponse.json({
      ok: true,
      profile: await verifyFleetMobileWithFirebase(fleetId, firebaseIdToken),
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
