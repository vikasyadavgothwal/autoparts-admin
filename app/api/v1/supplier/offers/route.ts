import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { listSupplierOffers } from "@/services/supplier/supplier-offers-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) return auth.response

  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(
    request.nextUrl.searchParams.get("pageSize") ?? "10",
    10,
  )
  const search = request.nextUrl.searchParams.get("search") ?? ""
  const status = request.nextUrl.searchParams.get("status") ?? ""

  return NextResponse.json({
    ok: true,
    ...(await listSupplierOffers(auth.user.id, page, pageSize, search, status)),
  })
}
