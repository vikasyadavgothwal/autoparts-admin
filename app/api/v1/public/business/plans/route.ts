import { NextResponse } from "next/server"

import { listBusinessPlans } from "@/services/business/business-platform-service"

export async function GET() {
  const plans = await listBusinessPlans()
  return NextResponse.json({
    ok: true,
    plans: plans.filter((plan) => plan.isActive),
  })
}
