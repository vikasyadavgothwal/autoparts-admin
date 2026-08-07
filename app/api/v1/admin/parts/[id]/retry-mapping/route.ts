import { NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  getSupplierPartById,
  runSupplierPartMapping,
} from "@/services/parts-mapping"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }
  const { id } = await params
  try {
    await runSupplierPartMapping(id)
    const part = await getSupplierPartById(id)
    return NextResponse.json({ ok: true, part }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to retry mapping",
      },
      { status: 400 },
    )
  }
}
