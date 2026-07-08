import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { db } from "@/lib/database/prisma"
import { createSignedS3ObjectUrl } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const key = request.nextUrl.searchParams.get("key")?.trim()
  if (!key) {
    return NextResponse.json(
      { ok: false, message: "Invalid product image key" },
      { status: 400 },
    )
  }

  const ownsImage = await db.supplierPart.findFirst({
    where: {
      supplierId: auth.user.id,
      part: { imageKeys: { has: key } },
    },
    select: { id: true },
  })
  if (!ownsImage) {
    return NextResponse.json(
      { ok: false, message: "Product image is not available" },
      { status: 403 },
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
