import { NextRequest, NextResponse } from "next/server"

import { UserRole } from "@/lib/generated/prisma/client"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getOptionalUserFromRequest } from "@/lib/auth/api-guards"
import { assertBusinessMenuAccess, getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
import { listSupplierProductReviews } from "@/services/supplier-product-reviews/supplier-product-review-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    )
  }
  if (
    auth.user.activeRole !== UserRole.Supplier ||
    !auth.user.roles.includes(UserRole.Supplier)
  ) {
    return NextResponse.json(
      { ok: false, message: "Supplier role is required" },
      { status: 403 },
    )
  }

  try {
    await assertBusinessMenuAccess({ userId: auth.user.id, accountType: BusinessAccountType.Supplier, menuKey: "reviews" })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "You do not have permission to view reviews" }, { status: 403 })
  }

  const page = Number.parseInt(
    request.nextUrl.searchParams.get("page") ?? "1",
    10,
  )
  const pageSize = Number.parseInt(
    request.nextUrl.searchParams.get("pageSize") ?? "10",
    10,
  )
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)
  const result = await listSupplierProductReviews(supplierId, page, pageSize)

  return NextResponse.json({
    ok: true,
    ...result,
  })
}
