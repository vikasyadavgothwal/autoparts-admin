import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getS3ImageDisplayUrlFromKey } from "@/lib/storage/s3"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { supplierOwnsCatalogProductImage } from "@/services/parts/product-image-service"

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

  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)
  const ownsImage = await supplierOwnsCatalogProductImage({
    supplierId,
    key,
  })
  if (!ownsImage) {
    return NextResponse.json(
      { ok: false, message: "Product image is not available" },
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
