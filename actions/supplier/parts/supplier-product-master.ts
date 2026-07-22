"use server"

import { saveSupplierProductMaster } from "@/services/parts-mapping"
import type { SupplierProductMasterInput } from "@/types/parts-mapping/parts-mapping"

export async function createSupplierProductMaster(
  supplierId: string,
  input: SupplierProductMasterInput,
) {
  return saveSupplierProductMaster(supplierId, input)
}

export async function updateSupplierProductMaster(
  supplierId: string,
  supplierPartId: string,
  input: SupplierProductMasterInput,
) {
  return saveSupplierProductMaster(supplierId, input, supplierPartId)
}
