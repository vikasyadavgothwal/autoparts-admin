import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/auth/api-guards"
import { getS3ImageDisplayUrlFromKey } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const key = request.nextUrl.searchParams.get("key")?.trim()
  if (!key || !key.startsWith(`garage-profiles/${auth.user.id}/`)) {
    return NextResponse.json(
      { ok: false, message: "Garage image is not available" },
      { status: 403 },
    )
  }

  try {
    return NextResponse.redirect(getS3ImageDisplayUrlFromKey(key))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load image",
      },
      { status: 500 },
    )
  }
}
