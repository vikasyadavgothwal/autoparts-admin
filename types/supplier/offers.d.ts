export type SupplierOfferStatus = "submitted" | "accepted" | "rejected" | "withdrawn"

export type SupplierOfferPart = {
  id: string
  partName: string
  partNumber: string | null
  quantity: number
  targetPrice: number | null
  notes: string | null
}

export type SupplierOfferOrder = {
  id: string
  publicId: string
  status: string
  totalAmount: number
  createdAt: string
}

export type SupplierOfferRecord = {
  id: string
  rfqId: string
  rfqPublicId: string
  rfqStatus: string
  source: string
  buyerCompanyName: string
  buyerContactName: string
  buyerEmail: string
  projectName: string
  description: string | null
  vehicleVin: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleTrim: string | null
  responseDeadline: string
  deliveryRequirement: string
  paymentTerms: string
  parts: SupplierOfferPart[]
  totalAmount: number
  deliveryDays: number
  validUntil: string | null
  notes: string | null
  status: SupplierOfferStatus
  submittedAt: string
  updatedAt: string
  order: SupplierOfferOrder | null
}

export type SupplierOfferSummary = {
  totalOffers: number
  totalAmount: number
  byStatus: Partial<Record<SupplierOfferStatus, number>>
}
