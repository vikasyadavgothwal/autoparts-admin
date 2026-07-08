import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import { createFleetVehicle, listFleetVehicles } from "@/services/fleet/fleet-service"
import type { FleetVehicleInput } from "@/types/rfq/rfq"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
  return NextResponse.json({
    ok: true,
    ...(await listFleetVehicles(auth.user.id, page, pageSize)),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<FleetVehicleInput>(request)
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
  try {
    const vehicle = await createFleetVehicle(auth.user.id, parsed.body)
    return NextResponse.json({ ok: true, vehicle }, { status: 201 })
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
        ? "A vehicle with this VIN already exists in your fleet"
        : error instanceof Error
          ? error.message
          : "Unable to add vehicle"
    return NextResponse.json(
      { ok: false, message },
      { status: 400 },
    )
  }
}
