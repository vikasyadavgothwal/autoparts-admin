import { NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { listBusinessPlans } from "@/services/business/business-platform-service"

export async function GET() {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    plans: await listBusinessPlans(),
  })
}
