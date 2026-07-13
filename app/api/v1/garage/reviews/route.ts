import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/parts-mapping/auth"
import { listGarageServiceReviews } from "@/services/garage/garage-review-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    reviews: await listGarageServiceReviews(auth.user.id),
  })
}
