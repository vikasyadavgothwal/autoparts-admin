import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { SupplierPartMappingStatus } from "@/lib/generated/prisma/client"
import { listSupplierParts } from "@/services/parts-mapping/parts-mapping-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const rawStatus = request.nextUrl.searchParams.get("status")
  const query = request.nextUrl.searchParams.get("q") ?? undefined
  const status =
    rawStatus && rawStatus in SupplierPartMappingStatus
      ? (rawStatus as SupplierPartMappingStatus)
      : SupplierPartMappingStatus.pending_review

  const parts = await listSupplierParts({ status, query, limit: 250 })
  return NextResponse.json({ ok: true, parts }, { status: 200 })
}
