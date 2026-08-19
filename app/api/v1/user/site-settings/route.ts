import { NextResponse } from "next/server"

import { readMainWebsiteSiteSettings } from "@/actions/platform-settings/platform-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      settings: await readMainWebsiteSiteSettings(),
    })
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to load website settings" },
      { status: 500 },
    )
  }
}
