import { NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { approveFirstVendorProduct } from "@/services/parts-mapping/parts-mapping-service"

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
    const part = await approveFirstVendorProduct(id)
    return NextResponse.json({ ok: true, part }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to approve product",
      },
      { status: 400 },
    )
  }
}
