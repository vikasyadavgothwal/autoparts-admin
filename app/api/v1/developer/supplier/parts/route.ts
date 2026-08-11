import { NextRequest } from "next/server"

import { apiCreated, apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { createSupplierProductMaster } from "@/actions/supplier/parts/supplier-product-master"
import { assertBusinessPlanLimit, assertSupplierCatalogPlanLimits, logBusinessActivity } from "@/services/business/business-platform-service"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { createSupplierPart, listSupplierPartsPage } from "@/services/parts-mapping"
import type { SupplierPartCreateInput, SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Supplier, "supplier.inventory.read")
  if (!auth.ok) return auth.response
  const status = request.nextUrl.searchParams.get("status") ?? undefined
  const query = request.nextUrl.searchParams.get("q") ?? undefined
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "10", 10)
  return apiOk(await listSupplierPartsPage({
    supplierId: auth.context.ownerUserId,
    status: status as Parameters<typeof listSupplierPartsPage>[0]["status"],
    query,
    page,
    pageSize,
  }))
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Supplier, "supplier.inventory.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<SupplierPartCreateInput | SupplierProductMasterInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    await assertSupplierCatalogPlanLimits({
      userId: auth.context.ownerUserId,
      brands: ["brand" in parsed.body ? parsed.body.brand : null],
      categories: ["category" in parsed.body ? parsed.body.category : null],
    })
    const currentCount = await db.supplierPart.count({ where: { supplierId: auth.context.ownerUserId, isActive: true } })
    await assertBusinessPlanLimit({
      userId: auth.context.ownerUserId,
      accountType: BusinessAccountType.Supplier,
      limit: "productLimit",
      currentCount,
    })
    const part = parsed.body && "mode" in parsed.body && parsed.body.mode === "product_master_form"
      ? await createSupplierProductMaster(auth.context.ownerUserId, parsed.body)
      : await createSupplierPart(auth.context.ownerUserId, parsed.body as SupplierPartCreateInput)
    await logBusinessActivity({
      businessAccountId: auth.context.businessAccountId,
      actorUserId: auth.context.ownerUserId,
      action: "developer_api.supplier_part.created",
      entityType: "supplier_part",
      entityId: part.id,
      metadata: { apiKeyId: auth.context.apiKeyId },
    })
    return apiCreated({ part })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to save part"))
  }
}
