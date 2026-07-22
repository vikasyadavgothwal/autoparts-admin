import { NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { deleteSupplierPart } from "@/services/parts-mapping"

export const dynamic = "force-dynamic"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const deletedPart = await deleteSupplierPart(id)
    return NextResponse.json({ ok: true, deletedPart }, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete supplier part"

    return NextResponse.json(
      { ok: false, message },
      { status: message === "Supplier part not found" ? 404 : 400 },
    )
  }
}
