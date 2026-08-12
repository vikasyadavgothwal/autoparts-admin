import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { deleteSupplierPart, updateSupplierPartOffer } from "@/services/parts-mapping"
import type { SupplierOfferUpdateInput } from "@/types/parts-mapping/parts-mapping"
import type { SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"
import { updateSupplierProductMaster } from "@/actions/supplier/parts/supplier-product-master"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  assertBusinessAction,
  assertBusinessPlanLimit,
  assertSupplierCatalogPlanLimits,
  getBusinessAccountOwnerId,
  reconcileSupplierProductPlan,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

const catalogValueName = (value: unknown) => {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "name" in value) {
    return typeof value.name === "string" ? value.name : null
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)

  const parsed = await readJsonBody<SupplierOfferUpdateInput | SupplierProductMasterInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const { id } = await params
  try {
    await assertBusinessAction({
      userId: auth.user.id,
      accountType: BusinessAccountType.Supplier,
      action: "products.update",
    })
    const productMaster =
      "mode" in parsed.body && parsed.body.mode === "product_master_form"
        ? (parsed.body as SupplierProductMasterInput)
        : null
    if (productMaster?.marketplace?.isActive === true) {
      await assertSupplierCatalogPlanLimits({
        userId: auth.user.id,
        brands: [catalogValueName(productMaster.brand)],
        categories: [catalogValueName(productMaster.category)],
      })
      const activeProductCount = await db.supplierPart.count({
        where: { supplierId, isActive: true },
      })
      await assertBusinessPlanLimit({
        userId: auth.user.id,
        accountType: BusinessAccountType.Supplier,
        limit: "productLimit",
        currentCount: activeProductCount,
      })
    }
    const part = productMaster
      ? await updateSupplierProductMaster(supplierId, id, productMaster)
      : await updateSupplierPartOffer(supplierId, id, parsed.body as SupplierOfferUpdateInput)
    return NextResponse.json({ ok: true, part }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update stock",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)

  const { id } = await params
  try {
    await assertBusinessAction({
      userId: auth.user.id,
      accountType: BusinessAccountType.Supplier,
      action: "products.delete",
    })
    const deletedPart = await deleteSupplierPart(id, supplierId)
    await reconcileSupplierProductPlan(supplierId)
    return NextResponse.json({ ok: true, deletedPart }, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete supplier product"
    return NextResponse.json(
      { ok: false, message },
      { status: message === "Supplier part not found" ? 404 : 400 },
    )
  }
}
