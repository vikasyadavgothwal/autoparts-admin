import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import {
  deleteFleetVehicle,
  updateFleetVehicle,
} from "@/services/fleet/fleet-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<FleetVehicleInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }
  try {
    const vehicle = await updateFleetVehicle(
      auth.user.id,
      (await context.params).id,
      parsed.body,
    )
    return NextResponse.json({ ok: true, vehicle })
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
        ? "A vehicle with this VIN already exists in your fleet"
        : error instanceof Error
          ? error.message
          : "Unable to update vehicle"
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json({
      ok: true,
      ...(await deleteFleetVehicle(auth.user.id, (await context.params).id)),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to delete vehicle",
      },
      { status: 400 },
    )
  }
}
