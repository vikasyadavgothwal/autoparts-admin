import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody } from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { updateSupplierProductMaster } from "@/actions/supplier/parts/supplier-product-master"
import { requireDeveloperApiKey } from "@/services/business/business-api-key-service"
import { updateSupplierPartOffer } from "@/services/parts-mapping"
import type { SupplierOfferUpdateInput, SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireDeveloperApiKey(request, BusinessAccountType.Supplier, "supplier.inventory.write")
  if (!auth.ok) return auth.response
  const parsed = await readJsonBody<SupplierOfferUpdateInput | SupplierProductMasterInput>(request)
  if (!parsed.ok) return apiError(parsed.message)
  try {
    const { id } = await context.params
    const part = parsed.body && "mode" in parsed.body && parsed.body.mode === "product_master_form"
      ? await updateSupplierProductMaster(auth.context.ownerUserId, id, parsed.body)
      : await updateSupplierPartOffer(auth.context.ownerUserId, id, parsed.body as SupplierOfferUpdateInput)
    return apiOk({ part })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update part"))
  }
}
