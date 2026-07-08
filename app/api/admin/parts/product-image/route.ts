import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { createSignedS3ObjectUrl } from "@/lib/storage/s3"

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
    const signedUrl = await createSignedS3ObjectUrl(key, 5 * 60)
    return NextResponse.redirect(signedUrl)
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
