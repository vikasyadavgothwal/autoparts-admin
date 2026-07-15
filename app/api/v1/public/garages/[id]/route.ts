import { NextRequest, NextResponse } from "next/server"

import { getPublicGarage } from "@/services/garage/public-garage-service"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const garage = await getPublicGarage((await context.params).id)
    if (!garage) {
      return NextResponse.json(
        { ok: false, message: "Garage not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, garage })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load garage",
      },
      { status: 500 },
    )
  }
}
