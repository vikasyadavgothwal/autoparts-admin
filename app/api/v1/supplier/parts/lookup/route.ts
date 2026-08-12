import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { lookupSupplierPart } from "@/services/parts-mapping"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import type { SupplierPartLookupInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)

  const parsed = await readJsonBody<SupplierPartLookupInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const result = await lookupSupplierPart(supplierId, parsed.body)
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
