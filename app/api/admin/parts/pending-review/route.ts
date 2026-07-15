import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { listMappedCatalogPartsPage } from "@/services/parts-mapping/parts-mapping-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const query = request.nextUrl.searchParams.get("q") ?? undefined
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)

  const result = await listMappedCatalogPartsPage({ query, page, pageSize })
  return NextResponse.json({ ok: true, ...result }, { status: 200 })
}
