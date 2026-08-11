import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/database/prisma"
import { getOptionalUserFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType, OrderStatus, RfqSource } from "@/lib/generated/prisma/client"
import { assertBusinessAction, assertBusinessPlanLimit } from "@/services/business/business-platform-service"
import { acceptRfqBid } from "@/services/fleet/fleet-service"

const readOptionalAddressId = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as { addressId?: unknown } | null
    return typeof body?.addressId === "string" ? body.addressId.trim() : ""
  } catch {
    return ""
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; bidId: string }> },
) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }
  const source =
    auth.user.activeRole === "Fleet" && auth.user.roles.includes("Fleet")
      ? RfqSource.fleet
      : auth.user.activeRole === "User" && auth.user.roles.includes("User")
        ? RfqSource.user
        : null
  if (!source) {
    return NextResponse.json(
      { ok: false, message: "User or Fleet role is required" },
      { status: 403 },
    )
  }
  try {
    const { id, bidId } = await context.params
    if (source === RfqSource.fleet) {
      const existingOrder = await db.order.findFirst({
        where: { rfqId: id, buyerId: auth.user.id },
        select: { bidId: true },
      })
      if (!existingOrder) {
        await assertBusinessAction({
          userId: auth.user.id,
          accountType: BusinessAccountType.Fleet,
          action: "orders.create",
        })
        const currentCount = await db.order.count({
          where: { buyerId: auth.user.id, status: { not: OrderStatus.cancelled } },
        })
        await assertBusinessPlanLimit({
          userId: auth.user.id,
          accountType: BusinessAccountType.Fleet,
          limit: "orderLimit",
          currentCount,
        })
      }
    }
    const addressId = await readOptionalAddressId(request)
    const order = await acceptRfqBid(auth.user.id, id, bidId, source, addressId)
    return NextResponse.json({ ok: true, order })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to accept quote" },
      { status: 400 },
    )
  }
}
