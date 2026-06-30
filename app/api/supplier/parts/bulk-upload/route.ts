import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import { createSupplierPartsBulk } from "@/services/parts-mapping/parts-mapping-service"
import type { SupplierPartBulkRow } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

type BulkBody = {
  rows?: SupplierPartBulkRow[]
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<BulkBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  if (!Array.isArray(parsed.body.rows)) {
    return NextResponse.json(
      { ok: false, message: "rows must be an array" },
      { status: 400 },
    )
  }

  const summary = await createSupplierPartsBulk(auth.user.id, parsed.body.rows)
  return NextResponse.json({ ok: true, summary }, { status: 200 })
}
