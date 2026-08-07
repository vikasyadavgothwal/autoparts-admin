import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/database/prisma"
import { BusinessAccountType, RfqBidStatus } from "@/lib/generated/prisma/client"
import { readJsonBody, requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { assertBusinessPlanLimit } from "@/services/business/business-platform-service"
import { submitRfqBid } from "@/services/fleet/fleet-service"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) return auth.response
  const body = await readJsonBody<{
    deliveryDays?: unknown
    validUntil?: unknown
    notes?: unknown
    items?: unknown
  }>(request)
  if (!body.ok) return NextResponse.json({ ok: false, message: body.message }, { status: 400 })
  try {
    const { id } = await context.params
    const existingBid = await db.rfqBid.findUnique({
      where: { rfqId_supplierId: { rfqId: id, supplierId: auth.user.id } },
      select: { id: true },
    })
    if (!existingBid) {
      const currentCount = await db.rfqBid.count({
        where: { supplierId: auth.user.id, status: { not: RfqBidStatus.withdrawn } },
      })
      await assertBusinessPlanLimit({
        userId: auth.user.id,
        accountType: BusinessAccountType.Supplier,
        limit: "rfqLimit",
        currentCount,
      })
    }
    const bid = await submitRfqBid(auth.user.id, id, body.body)
    return NextResponse.json({ ok: true, bid }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to submit quote" },
      { status: 400 },
    )
  }
}
