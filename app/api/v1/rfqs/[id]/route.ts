import { NextRequest, NextResponse } from "next/server"

import { getOptionalUserFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { getFleetRfq, getSupplierRfq, getUserRfq } from "@/services/fleet/fleet-service"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await context.params
    if (auth.user.activeRole === "Fleet" && auth.user.roles.includes("Fleet")) {
      const fleetId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
      return NextResponse.json({ ok: true, rfq: await getFleetRfq(fleetId, id) })
    }
    if (auth.user.activeRole === "Supplier" && auth.user.roles.includes("Supplier")) {
      const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)
      return NextResponse.json({ ok: true, rfq: await getSupplierRfq(supplierId, id) })
    }
    if (auth.user.activeRole === "User" && auth.user.roles.includes("User")) {
      return NextResponse.json({ ok: true, rfq: await getUserRfq(auth.user.id, id) })
    }
    return NextResponse.json({ ok: false, message: "User, Supplier, or Fleet role is required" }, { status: 403 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load RFQ" },
      { status: 404 },
    )
  }
}
