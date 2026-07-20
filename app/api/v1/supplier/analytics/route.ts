import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { getSupplierAnalytics } from "@/services/supplier/supplier-analytics-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    analytics: await getSupplierAnalytics(auth.user.id),
  })
}
