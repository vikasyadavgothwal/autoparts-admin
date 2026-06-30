import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { updateSupplierPartOffer } from "@/services/parts-mapping/parts-mapping-service"
import type { SupplierOfferUpdateInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<SupplierOfferUpdateInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const { id } = await params
  try {
    const part = await updateSupplierPartOffer(auth.user.id, id, parsed.body)
    return NextResponse.json({ ok: true, part }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update stock",
      },
      { status: 400 },
    )
  }
}
