import { NextResponse } from "next/server"

import { getGarageBookingAdvanceSetting } from "@/services/platform-settings/platform-settings-service"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    ok: true,
    advance: await getGarageBookingAdvanceSetting(),
  })
}
