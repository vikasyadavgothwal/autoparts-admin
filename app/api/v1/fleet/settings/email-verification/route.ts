import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import { requestFleetEmailVerification } from "@/services/fleet/fleet-settings-service"

type EmailVerificationBody = {
  email?: unknown
  verificationBaseUrl?: unknown
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<EmailVerificationBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const origin = new URL(request.url).origin
    return NextResponse.json(
      await requestFleetEmailVerification(
        auth.user.id,
        parsed.body.email,
        origin,
        typeof parsed.body.verificationBaseUrl === "string"
          ? parsed.body.verificationBaseUrl
          : null,
      ),
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to send verification link",
      },
      { status: 400 },
    )
  }
}
