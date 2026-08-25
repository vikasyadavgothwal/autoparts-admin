import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/database/prisma"
import { getOptionalUserFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType, OrderStatus, RfqSource } from "@/lib/generated/prisma/client"
import { assertBusinessAction, assertBusinessPlanLimit, getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { acceptRfqBid } from "@/services/fleet/fleet-service"

const readAcceptBody = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      addressId?: unknown
      paymentSuccessUrl?: unknown
      paymentCancelUrl?: unknown
    } | null
    return {
      addressId: typeof body?.addressId === "string" ? body.addressId.trim() : "",
      paymentSuccessUrl: body?.paymentSuccessUrl,
      paymentCancelUrl: body?.paymentCancelUrl,
    }
  } catch {
    return { addressId: "", paymentSuccessUrl: undefined, paymentCancelUrl: undefined }
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
    const fleetId = source === RfqSource.fleet
      ? await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
      : auth.user.id
    if (source === RfqSource.fleet) {
      const existingOrder = await db.order.findFirst({
        where: { rfqId: id, buyerId: fleetId },
        select: { bidId: true },
      })
      if (!existingOrder) {
        await assertBusinessAction({
          userId: auth.user.id,
          accountType: BusinessAccountType.Fleet,
          action: "orders.create",
        })
        const currentCount = await db.order.count({
          where: { buyerId: fleetId, status: { not: OrderStatus.cancelled } },
        })
        await assertBusinessPlanLimit({
          userId: auth.user.id,
          accountType: BusinessAccountType.Fleet,
          limit: "orderLimit",
          currentCount,
        })
      }
    }
    const body = await readAcceptBody(request)
    const result = await acceptRfqBid(
      fleetId,
      id,
      bidId,
      source,
      body.addressId,
      body.paymentSuccessUrl,
      body.paymentCancelUrl,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to accept quote" },
      { status: 400 },
    )
  }
}
