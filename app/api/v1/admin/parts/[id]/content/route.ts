import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import { updateSupplierPartContent } from "@/services/parts-mapping"
import type { PartContentUpdateInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<PartContentUpdateInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const { id } = await params
  try {
    const part = await updateSupplierPartContent(id, parsed.body)
    return NextResponse.json({ ok: true, part }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update content",
      },
      { status: 400 },
    )
  }
}
