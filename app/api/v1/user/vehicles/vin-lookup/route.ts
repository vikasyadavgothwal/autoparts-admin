import { NextRequest, NextResponse } from "next/server"

import { requireCustomerUserFromRequest } from "@/lib/parts-mapping/auth"
import { resolveVehicleVins } from "@/services/fleet/rfq-import-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const vin = request.nextUrl.searchParams.get("vin")?.trim().toUpperCase() ?? ""
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return NextResponse.json({ ok: false, message: "Enter a valid 17-character VIN" }, { status: 400 })
  }

  try {
    const [vehicle] = await resolveVehicleVins([vin])
    return NextResponse.json({ ok: true, found: true, vehicle })
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIN lookup failed"
    if (message.startsWith("We could not find these VINs:")) {
      return NextResponse.json({ ok: true, found: false, message: "We could not find this VIN in our database or VIN provider. Check and correct the VIN." })
    }
    return NextResponse.json({ ok: false, message }, { status: 503 })
  }
}
