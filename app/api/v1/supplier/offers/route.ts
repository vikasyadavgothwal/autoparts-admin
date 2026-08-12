import { NextRequest } from "next/server"

import { apiOk, withSupplierApiRoute } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { listSupplierOffers } from "@/services/supplier/supplier-offers-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
    const pageSize = Number.parseInt(
      request.nextUrl.searchParams.get("pageSize") ?? "10",
      10,
    )
    const search = request.nextUrl.searchParams.get("search") ?? ""
    const status = request.nextUrl.searchParams.get("status") ?? ""
    const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier)

    return apiOk(await listSupplierOffers(supplierId, page, pageSize, search, status))
  })
}
