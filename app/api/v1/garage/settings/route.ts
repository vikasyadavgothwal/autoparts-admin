import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import {
  getGarageProfile,
  updateGarageProfile,
} from "@/services/garage/garage-settings-service"
import type { GarageProfileInput } from "@/types/garage/settings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response
  const garageId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Garage)

  return NextResponse.json({
    ok: true,
    profile: await getGarageProfile(garageId),
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageProfileInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const garageId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Garage)
    if (garageId !== auth.user.id) {
      return NextResponse.json(
        { ok: false, message: "Only the garage owner can update workspace settings" },
        { status: 403 },
      )
    }
    return NextResponse.json({
      ok: true,
      profile: await updateGarageProfile(garageId, parsed.body),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update settings",
      },
      { status: 400 },
    )
  }
}
