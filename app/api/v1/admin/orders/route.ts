import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { listAllOrders } from "@/services/orders/order-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
  const search = request.nextUrl.searchParams.get("search") ?? ""
  return NextResponse.json({ ok: true, ...(await listAllOrders(page, pageSize, search)) })
}
