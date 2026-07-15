import type {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
} from "@/lib/generated/prisma/client"

export type FirstVendorProductInput = {
  partName: string
  category: string
  badgeText: string
  heading: string
  description: string
  keyFeatures: string[]
  imageUrls: string[]
  imageKeys: string[]
}

export type PartContentUpdateInput = FirstVendorProductInput

export type SupplierOfferUpdateInput = {
  price: number | string
  stock: number | string
  vendorSku?: string | null
  productName?: string | null
  shortDescription?: string | null
  longDescription?: string | null
  mpn?: string | null
  status?: string | null
  grade?: string | null
  condition?: string | null
  basePrice?: number | string | null
  discountPrice?: number | string | null
  currency?: string | null
  taxClass?: string | null
  vat?: string | null
  maxRetailPrice?: number | string | null
  wholesaleDistributorPrice?: number | string | null
  fleetPrice?: number | string | null
  rawUploadData?: unknown
}

export type SupplierPartLookupInput = {
  vendorSku?: string | null
  brand?: string | null
  mpn?: string | null
  partNumber?: string | null
  oemNumber?: string | null
  competitorPartNumber?: string | null
  competitorBrandName?: string | null
}

export type SupplierPartCreateInput = SupplierPartLookupInput & {
  partUid?: string | null
  completePartUid?: string | null
  price: number | string
  stock: number | string
  currency?: string | null
  product?: FirstVendorProductInput | null
  rawUploadData?: unknown
}

export type SupplierPartBulkRow = SupplierPartCreateInput

export type SupplierBulkProductRow = {
  rowNumber: number
  vendorSku: string
  oemNumber: string
  mpn?: string | null
  brand?: string | null
  price?: number | string | null
  stock?: number | string | null
  productName?: string | null
  shortDescription?: string | null
  longDescription?: string | null
  status?: string | null
  grade?: string | null
  condition?: string | null
  oemSupersessionNumbers?: string[]
  competitorPartNumber?: string | null
  competitorBrandName?: string | null
  hsCode?: string | null
  imageUrls?: string[]
  rawUploadData?: unknown
}

export type SupplierBulkImageRow = {
  rowNumber: number
  vendorSku: string
  primaryImageUrl: string
  galleryImageUrls: string[]
}

export type SupplierBulkStockRow = {
  rowNumber: number
  vendorSku: string
  warehouseId: string
  quantity: number | string
  leadTime?: string | null
  lowStockThreshold?: number | string | null
  rawUploadData?: unknown
}

export type SupplierBulkPricingRow = {
  rowNumber: number
  vendorSku: string
  basePrice?: number | string | null
  discountPrice?: number | string | null
  currency?: string | null
  taxClass?: string | null
  vat?: string | null
  maxRetailPrice?: number | string | null
  wholesaleDistributorPrice?: number | string | null
  fleetPrice?: number | string | null
  rawUploadData?: unknown
}

export type SupplierPartRecord = {
  id: string
  supplierId: string
  supplierName: string | null
  vendorSku: string | null
  partUid: string | null
  originalPartName: string
  originalBrand: string | null
  originalMpn: string | null
  originalOemNumber: string | null
  normalizedMpn: string | null
  normalizedOemNumber: string | null
  price: number
  stock: number
  currency: string | null
  category: string | null
  oemSupersessionNumbers: string[]
  competitorPartNumber: string | null
  competitorBrandName: string | null
  hsCode: string | null
  supplierImageUrls: string[]
  mappingStatus: SupplierPartMappingStatus
  mappingSource: SupplierPartMappingSource | null
  mappingError: string | null
  rawUploadData?: unknown
  createdAt: string
  updatedAt: string
  part: {
    partUid: string
    partName: string | null
    partNumber: string | null
    brandName: string | null
    category: string | null
    source: string
    imageUrls: string[]
    imageKeys: string[]
    badgeText: string | null
    heading: string | null
    description: string | null
    keyFeatures: string[]
  } | null
}

export type PartMasterSummary = {
  partUid: string
  partName: string | null
  partNumber: string | null
  brandName: string | null
  category: string | null
  source: string
  imageUrls: string[]
  imageKeys: string[]
  badgeText: string | null
  heading: string | null
  description: string | null
  keyFeatures: string[]
}

export type MappedCatalogPartRecord = PartMasterSummary & {
  oemNumbers: string[]
  mpnNumbers: string[]
  mappedStatus: SupplierPartMappingStatus.mapped
  supplierPartCount: number
  latestSupplierPartUpdatedAt: string | null
}

export type SupplierPartLookupResult = {
  exists: boolean
  requiresProductDetails: boolean
  part: PartMasterSummary | null
  supplierOffer: SupplierPartRecord | null
  vin17Suggestion: {
    partNumber: string | null
    partName: string | null
    brandName: string | null
    category: string | null
    imageUrl: string | null
  } | null
  message?: string
}

export type ManualMapInput = {
  partUid?: string
  partNumber?: string | null
  partName?: string | null
  brandName?: string | null
  category?: string | null
  groupId?: string | null
  numbers?: Array<{
    numberOriginal: string
    numberType?: PartNumberType
    brand?: string | null
  }>
}

export type PartSearchResult = {
  part: PartMasterSummary
  supplierParts: SupplierPartRecord[]
  fitments: Array<{
    brand: string | null
    make: string | null
    model: string | null
    series: string | null
    modelYear: number | null
    yearFrom: number | null
    yearTo: number | null
    engine: string | null
    engineNo: string | null
  }>
}

export type PartSearchResponse =
  | {
      ok: true
      found: true
      result: PartSearchResult
    }
  | {
      ok: true
      found: false
      result: null
    }
