import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import {
  deleteAdminGarage,
  updateAdminGarage,
  type GarageAdminUpdateInput,
} from "@/services/admin-dashboard/garages/garage-management-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageAdminUpdateInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const garage = await updateAdminGarage((await context.params).id, parsed.body)
    return NextResponse.json({ ok: true, garage })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update garage",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({
      ok: true,
      ...(await deleteAdminGarage((await context.params).id)),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to delete garage",
      },
      { status: 400 },
    )
  }
}
