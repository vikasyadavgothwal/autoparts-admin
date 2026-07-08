import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { lookupSupplierPart } from "@/services/parts-mapping/parts-mapping-service"
import type { SupplierPartLookupInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<SupplierPartLookupInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const result = await lookupSupplierPart(auth.user.id, parsed.body)
    return NextResponse.json({ ok: true, result }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to look up part",
      },
      { status: 400 },
    )
  }
}
