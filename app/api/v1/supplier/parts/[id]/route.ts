import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { updateSupplierPartOffer } from "@/services/parts-mapping"
import type { SupplierOfferUpdateInput } from "@/types/parts-mapping/parts-mapping"
import type { SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"
import { updateSupplierProductMaster } from "@/actions/supplier/parts/supplier-product-master"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<SupplierOfferUpdateInput | SupplierProductMasterInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const { id } = await params
  try {
    const part = parsed.body && "mode" in parsed.body && parsed.body.mode === "product_master_form"
      ? await updateSupplierProductMaster(auth.user.id, id, parsed.body)
      : await updateSupplierPartOffer(auth.user.id, id, parsed.body as SupplierOfferUpdateInput)
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
