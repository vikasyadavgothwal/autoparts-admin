export type SupplierProductReviewInput = {
  orderItemId?: unknown
  rating?: unknown
  comment?: unknown
}

export type SupplierProductReviewRecord = {
  id: string
  supplierId: string
  supplierName: string
  customerId: string
  customerName: string
  supplierPartId: string
  partUid: string
  orderItemId: string
  orderPublicId: string
  orderSource: string
  partName: string
  partNumber: string | null
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
}

export type SupplierProductReviewSummary = {
  ratingAverage: number
  reviewCount: number
}

export type SupplierProductReviewPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}
