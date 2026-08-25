import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { getS3ImageDisplayUrlFromKey } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const key = request.nextUrl.searchParams.get("key")?.trim()
  if (
    !key ||
    (!key.startsWith("supplier-products/") &&
      !key.startsWith("product-images/"))
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid product image key" },
      { status: 400 },
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
