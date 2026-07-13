import { NextRequest, NextResponse } from "next/server"

import { verifyGarageEmail } from "@/services/garage/garage-settings-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? ""
  try {
    return NextResponse.json(await verifyGarageEmail(token))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify email",
      },
      { status: 400 },
    )
  }
}
