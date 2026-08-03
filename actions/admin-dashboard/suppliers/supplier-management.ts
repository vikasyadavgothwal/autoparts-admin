"use server"

import { updateAdminSupplierApproval } from "@/services/admin-dashboard/suppliers/supplier-management-service"
import type { SupplierStatus } from "@/types/admin-dashboard/suppliers/suppliers-types"

export async function reviewSupplierAccount(
  supplierId: string,
  status: SupplierStatus,
  adminId: string,
  rejectionReason?: string,
) {
  return updateAdminSupplierApproval(supplierId, status, adminId, rejectionReason)
}
