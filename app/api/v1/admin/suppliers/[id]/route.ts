import { NextRequest, NextResponse } from "next/server"

import { reviewSupplierAccount } from "@/actions/admin-dashboard/suppliers/supplier-management"
import { readJsonBody, requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import type { SupplierStatus } from "@/types/admin-dashboard/suppliers/suppliers-types"

type RouteContext = { params: Promise<{ id: string }> }
type ReviewSupplierBody = { status?: unknown }

const supplierStatuses = new Set<SupplierStatus>([
  "Approved",
  "Pending",
  "Rejected",
])

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<ReviewSupplierBody>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const status =
    typeof parsed.body.status === "string" ? parsed.body.status.trim() : ""
  if (!supplierStatuses.has(status as SupplierStatus)) {
    return NextResponse.json(
      { ok: false, message: "Supplier status is invalid" },
      { status: 400 },
    )
  }

  try {
    const supplier = await reviewSupplierAccount(
      (await context.params).id,
      status as SupplierStatus,
      auth.admin.id,
    )
    return NextResponse.json({ ok: true, supplier })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update supplier",
      },
      { status: 400 },
    )
  }
}
