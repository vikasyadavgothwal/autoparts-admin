import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import { createGarageService, listGarageServices } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    services: await listGarageServices(auth.user.id),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageServiceInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const service = await createGarageService(auth.user.id, parsed.body)
    return NextResponse.json({ ok: true, service }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to add service",
      },
      { status: 400 },
    )
  }
}
