import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import { deleteGarageService, updateGarageService } from "@/services/garage/garage-service"
import type { GarageServiceInput } from "@/types/garage/services"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const service = await updateGarageService(
      auth.user.id,
      (await context.params).id,
      parsed.body,
    )
    return NextResponse.json({ ok: true, service })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update service",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({
      ok: true,
      ...(await deleteGarageService(auth.user.id, (await context.params).id)),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to delete service",
      },
      { status: 400 },
    )
  }
}
