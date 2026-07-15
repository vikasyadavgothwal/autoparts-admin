import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/parts-mapping/auth"
import { requestGarageEmailVerification } from "@/services/garage/garage-settings-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const origin = new URL(request.url).origin
    return NextResponse.json(
      await requestGarageEmailVerification(auth.user.id, origin),
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
