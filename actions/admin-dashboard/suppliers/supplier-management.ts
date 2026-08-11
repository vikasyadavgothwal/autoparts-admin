"use server"

import { updateAdminSupplierApproval } from "@/services/admin-dashboard/suppliers/supplier-management-service"
import { updateAdminSupplierFeatured } from "@/services/admin-dashboard/suppliers/supplier-management-service"
import type { SupplierStatus } from "@/types/admin-dashboard/suppliers/suppliers-types"
import type { SupplierRecord } from "@/types/admin-dashboard/suppliers/suppliers-types"

type SupplierReviewNotificationResult = {
  sent: boolean
  skipped: boolean
  error: string | null
}

export async function reviewSupplierAccount(
  supplierId: string,
  status: SupplierStatus,
  adminId: string,
  rejectionReason?: string,
): Promise<{ supplier: SupplierRecord; notification: SupplierReviewNotificationResult }> {
  return updateAdminSupplierApproval(supplierId, status, adminId, rejectionReason)
}

export async function featureSupplierAccount(
  supplierId: string,
  featuredSupplier: boolean,
): Promise<SupplierRecord> {
  return updateAdminSupplierFeatured(supplierId, featuredSupplier)
}
