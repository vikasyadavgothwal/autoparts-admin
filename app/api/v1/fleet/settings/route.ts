import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import {
  getFleetProfile,
  updateFleetProfile,
} from "@/services/fleet/fleet-settings-service"
import type { FleetProfileInput } from "@/types/fleet/settings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  const fleetId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)

  return NextResponse.json({
    ok: true,
    profile: await getFleetProfile(fleetId),
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<FleetProfileInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const fleetId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
    return NextResponse.json({
      ok: true,
      profile: await updateFleetProfile(fleetId, parsed.body),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update settings",
      },
      { status: 400 },
    )
  }
}
