import { NextRequest, NextResponse } from "next/server"

import {
  createSupplierPart,
  listSupplierPartsPage,
} from "@/services/parts-mapping"
import { readJsonBody, requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  assertBusinessPlanLimit,
  assertSupplierCatalogPlanLimits,
  logBusinessActivity,
} from "@/services/business/business-platform-service"
import type { SupplierPartCreateInput } from "@/types/parts-mapping/parts-mapping"
import type { SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"
import { createSupplierProductMaster } from "@/actions/supplier/parts/supplier-product-master"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined
  const query = request.nextUrl.searchParams.get("q") ?? undefined

  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
  const result = await listSupplierPartsPage({
    supplierId: auth.user.id,
    status: status as Parameters<typeof listSupplierPartsPage>[0]["status"],
    query,
    page,
    pageSize,
  })

  return NextResponse.json({ ok: true, ...result }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const parsed = await readJsonBody<SupplierPartCreateInput | SupplierProductMasterInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    await assertSupplierCatalogPlanLimits({
      userId: auth.user.id,
      brands: ["brand" in parsed.body ? parsed.body.brand : null],
      categories: ["category" in parsed.body ? parsed.body.category : null],
    })
    const currentCount = await db.supplierPart.count({
      where: { supplierId: auth.user.id, isActive: true },
    })
    const account = await assertBusinessPlanLimit({
      userId: auth.user.id,
      accountType: BusinessAccountType.Supplier,
      limit: "productLimit",
      currentCount,
    })
    const part = parsed.body && "mode" in parsed.body && parsed.body.mode === "product_master_form"
      ? await createSupplierProductMaster(auth.user.id, parsed.body)
      : await createSupplierPart(auth.user.id, parsed.body as SupplierPartCreateInput)
    await logBusinessActivity({
      businessAccountId: account.id,
      actorUserId: auth.user.id,
      action: "supplier_product.created",
      entityType: "supplier_part",
      entityId: part.id,
    })
    return NextResponse.json({ ok: true, part }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save part",
      },
      { status: 400 },
    )
  }
}
