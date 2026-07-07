import { NextRequest, NextResponse } from "next/server"

import { requireFleetFromRequest } from "@/lib/parts-mapping/auth"
import { acceptRfqBid } from "@/services/fleet/fleet-service"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; bidId: string }> },
) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  try {
    const { id, bidId } = await context.params
    const order = await acceptRfqBid(auth.user.id, id, bidId)
    return NextResponse.json({ ok: true, order })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to accept quote" },
      { status: 400 },
    )
  }
}
