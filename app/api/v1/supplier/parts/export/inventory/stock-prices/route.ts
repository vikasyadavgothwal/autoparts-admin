import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { buildSupplierInventoryStockPriceExport } from "@/services/parts-mapping/export.service"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)

  try {
    const exportData = await buildSupplierInventoryStockPriceExport(supplierId)
    const payload = new Blob([new Uint8Array(exportData.payload)])
    return new NextResponse(payload, {
      headers: {
        "content-type": exportData.contentType,
        "content-disposition": `attachment; filename="${exportData.filename}"`,
        "cache-control": "no-store",
        "x-export-format": exportData.format,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to export inventory stock and prices",
      },
      { status: 500 },
    )
  }
}
