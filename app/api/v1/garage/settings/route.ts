import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import {
  getGarageProfile,
  updateGarageProfile,
} from "@/services/garage/garage-settings-service"
import type { GarageProfileInput } from "@/types/garage/settings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    profile: await getGarageProfile(auth.user.id),
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
    return NextResponse.json({
      ok: true,
      profile: await updateGarageProfile(auth.user.id, parsed.body),
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
