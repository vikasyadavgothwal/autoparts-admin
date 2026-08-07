import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { listAdminBusinessSupportTickets } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    supportTickets: await listAdminBusinessSupportTickets(request.nextUrl.searchParams.get("status")),
  })
}
