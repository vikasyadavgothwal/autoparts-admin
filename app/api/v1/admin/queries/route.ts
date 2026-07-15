import { NextRequest, NextResponse } from "next/server"

import { listAdminBusinessQueries } from "@/actions/business-queries/business-queries"
import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(
    request.nextUrl.searchParams.get("pageSize") ?? "500",
    10,
  )
  const result = await listAdminBusinessQueries({
    page,
    pageSize,
    search: request.nextUrl.searchParams.get("search") ?? "",
    type: request.nextUrl.searchParams.get("type") ?? "",
    status: request.nextUrl.searchParams.get("status") ?? "",
  })

  return NextResponse.json({ ok: true, ...result })
}
