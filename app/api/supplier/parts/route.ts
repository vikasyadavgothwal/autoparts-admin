import { NextRequest, NextResponse } from "next/server"

import {
  createSupplierPart,
  listSupplierParts,
} from "@/services/parts-mapping/parts-mapping-service"
import { readJsonBody, requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import type { SupplierPartCreateInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined
  const query = request.nextUrl.searchParams.get("q") ?? undefined

  const parts = await listSupplierParts({
    supplierId: auth.user.id,
    status: status as Parameters<typeof listSupplierParts>[0]["status"],
    query,
  })

  return NextResponse.json({ ok: true, parts }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<SupplierPartCreateInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const part = await createSupplierPart(auth.user.id, parsed.body)
    return NextResponse.json({ ok: true, part }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save part",
      },
      { status: 400 },
    )
  }
}
