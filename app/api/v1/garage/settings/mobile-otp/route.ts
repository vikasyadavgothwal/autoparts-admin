import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { requestGarageMobileOtp } from "@/services/garage/garage-settings-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const garageId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Garage)
    return NextResponse.json(await requestGarageMobileOtp(garageId))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to send mobile OTP",
      },
      { status: 400 },
    )
  }
}
