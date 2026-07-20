import { Buffer } from "node:buffer"
import crypto from "node:crypto"

import { db } from "@/lib/database/prisma"
import { syncCatalogLookups } from "@/services/catalog/catalog-lookup-service"
import { deleteObjectFromS3, uploadObjectToS3 } from "@/lib/storage/s3"
import {
  get17VinApplicableModels,
  get17VinInterchanges,
  normalizePartNumber,
  searchPartIn17Vin,
  type Vin17PartCandidate,
  type Vin17VehicleCandidate,
} from "@/lib/17vin"
import {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
  UserRole,
  type Prisma,
} from "@/lib/generated/prisma/client"
import type {
  ManualMapInput,
  MappedCatalogPartRecord,
  PartSearchResponse,
  PartContentUpdateInput,
  SupplierBulkImageRow,
  SupplierBulkPricingRow,
  SupplierBulkProductRow,
  SupplierBulkStockRow,
  SupplierPartCreateInput,
  SupplierPartLookupInput,
  SupplierPartLookupResult,
  SupplierOfferUpdateInput,
  SupplierProductMasterInput,
} from "@/types/parts-mapping/parts-mapping"

const DEFAULT_CURRENCY = "AED"
const SUPPLIER_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const SUPPLIER_IMAGE_FETCH_TIMEOUT_MS = 15_000
const SUPPLIER_IMAGE_UPLOAD_CONCURRENCY = 3
const SUPPORTED_SUPPLIER_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const normalizeOptionalText = (value: unknown): string | null => {
  const normalized = normalizeText(value)
  return normalized || null
}

const normalizeVendorSku = (value: unknown): string =>
  normalizeText(value).toUpperCase()

const normalizeVendorSkuLookupKey = (value: unknown): string =>
  normalizeVendorSku(value).replace(/[^A-Z0-9]/g, "")

type SupplierSkuCandidate = {
  id: string
  vendorSku: string | null
}

const createSupplierPartSkuResolver = async (supplierId: string) => {
  const supplierParts = await db.supplierPart.findMany({
    where: {
      supplierId,
      vendorSku: { not: null },
    },
    select: {
      id: true,
      vendorSku: true,
    },
  })

  const exactMatches = new Map<string, SupplierSkuCandidate>()
  const compactMatches = new Map<string, SupplierSkuCandidate | null>()

  for (const supplierPart of supplierParts) {
    const exactKey = normalizeVendorSku(supplierPart.vendorSku)
    if (exactKey) {
      exactMatches.set(exactKey, supplierPart)
    }

    const compactKey = normalizeVendorSkuLookupKey(supplierPart.vendorSku)
    if (compactKey) {
      compactMatches.set(
        compactKey,
        compactMatches.has(compactKey) ? null : supplierPart,
      )
    }
  }

  return (vendorSku: string): SupplierSkuCandidate | null => {
    const exactKey = normalizeVendorSku(vendorSku)
    if (!exactKey) {
      return null
    }

    const exactMatch = exactMatches.get(exactKey)
    if (exactMatch) {
      return exactMatch
    }

    const compactKey = normalizeVendorSkuLookupKey(vendorSku)
    if (!compactKey) {
      return null
    }

    return compactMatches.get(compactKey) ?? null
  }
}

type SupplierOemCandidate = {
  id: string
  vendorSku: string | null
  partUid: string | null
}

const findSupplierPartBySupplierOem = async (
  supplierId: string,
  normalizedOemNumber: string | null,
  excludeId?: string | null,
): Promise<SupplierOemCandidate | null> => {
  if (!normalizedOemNumber) {
    return null
  }

  return db.supplierPart.findFirst({
    where: {
      supplierId,
      normalizedOemNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, vendorSku: true, partUid: true },
  })
}

const BRAND_ALIASES: Record<string, string> = {
  VOLKSWAGEN: "VW",
}

const normalizeBrandToken = (value: string): string => {
  const token = value.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return BRAND_ALIASES[token] ?? token
}

const brandsAreCompatible = (
  supplierBrand: string | null,
  candidateBrands: Array<string | null | undefined>,
): boolean => {
  if (!supplierBrand) {
    return true
  }

  const supplierToken = normalizeBrandToken(supplierBrand)
  if (!supplierToken) {
    return true
  }

  return candidateBrands.some((candidateBrand) =>
    candidateBrand
      ?.split(/[,/|;]+/)
      .map(normalizeBrandToken)
      .some((candidateToken) => candidateToken === supplierToken),
  )
}

const parseMoney = (value: number | string): number => {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Price must be a non-negative number")
  }

  return Math.round(numeric * 100)
}

const parseStock = (value: number | string): number => {
  const numeric = typeof value === "number" ? value : Number.parseInt(value, 10)
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error("Stock must be a non-negative whole number")
  }

  return numeric
}

const parseOptionalMoney = (
  value: number | string | null | undefined,
): number | null => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null
  }

  return parseMoney(value)
}

const parseNonNegativeWholeNumber = (
  value: number | string | null | undefined,
  label: string,
): number => {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative whole number`)
  }

  return numeric
}

const parseOptionalNonNegativeWholeNumber = (
  value: number | string | null | undefined,
  label: string,
): number | null => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null
  }

  return parseNonNegativeWholeNumber(value, label)
}

const parseJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

const makePartUid = () => `part_${crypto.randomUUID().replace(/-/g, "")}`

const mapSupplierPart = (part: {
  id: string
  supplierId: string
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
  rawUploadData?: Prisma.JsonValue | null
  pricing?: {
    basePrice: number | null
    discountPrice: number | null
    currency: string
    taxClass: string | null
    vat: string | null
    maxRetailPrice: number | null
    wholesaleDistributorPrice: number | null
    fleetPrice: number | null
    rawUploadData: Prisma.JsonValue | null
  } | null
  createdAt: Date
  updatedAt: Date
  supplier?: {
    companyName: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
  }
  part?: {
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
}) => {
  const toObject = (value: Prisma.JsonValue | null | undefined) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const moneyFromCents = (value: number | null) =>
    value === null ? "" : String(value / 100)
  const rawUploadData = {
    ...toObject(part.rawUploadData),
    ...toObject(part.pricing?.rawUploadData),
  }

  if (part.pricing) {
    rawUploadData["Base Price (AED)"] ??= moneyFromCents(part.pricing.basePrice)
    rawUploadData["Discount Price (AED)"] ??= moneyFromCents(
      part.pricing.discountPrice,
    )
    rawUploadData.Currency ??= part.pricing.currency
    rawUploadData["Tax Class"] ??= part.pricing.taxClass ?? ""
    rawUploadData.VAT ??= part.pricing.vat ?? ""
    rawUploadData["Max Retail Price"] ??= moneyFromCents(
      part.pricing.maxRetailPrice,
    )
    rawUploadData["Wholesale/Distributor Pricing"] ??= moneyFromCents(
      part.pricing.wholesaleDistributorPrice,
    )
    rawUploadData["Fleet Pricing"] ??= moneyFromCents(part.pricing.fleetPrice)
  }

  return {
  id: part.id,
  supplierId: part.supplierId,
  vendorSku: part.vendorSku,
  supplierName:
    part.supplier?.companyName ??
    [part.supplier?.firstName, part.supplier?.lastName].filter(Boolean).join(" ") ??
    part.supplier?.email ??
    null,
  partUid: part.partUid,
  originalPartName: part.originalPartName,
  originalBrand: part.originalBrand,
  originalMpn: part.originalMpn,
  originalOemNumber: part.originalOemNumber,
  normalizedMpn: part.normalizedMpn,
  normalizedOemNumber: part.normalizedOemNumber,
  price: part.price / 100,
  stock: part.stock,
  currency: part.currency,
  category: part.category,
  oemSupersessionNumbers: part.oemSupersessionNumbers,
  competitorPartNumber: part.competitorPartNumber,
  competitorBrandName: part.competitorBrandName,
  hsCode: part.hsCode,
  supplierImageUrls: part.supplierImageUrls,
  mappingStatus: part.mappingStatus,
  mappingSource: part.mappingSource,
  mappingError: part.mappingError,
  rawUploadData: Object.keys(rawUploadData).length > 0 ? rawUploadData : undefined,
  createdAt: part.createdAt.toISOString(),
  updatedAt: part.updatedAt.toISOString(),
  part: part.part
    ? {
        partUid: part.part.partUid,
        partName: part.part.partName,
        partNumber: part.part.partNumber,
        brandName: part.part.brandName,
        category: part.part.category,
        source: part.part.source,
        imageUrls: part.part.imageUrls,
        imageKeys: part.part.imageKeys,
        badgeText: part.part.badgeText,
        heading: part.part.heading,
        description: part.part.description,
        keyFeatures: part.part.keyFeatures,
      }
    : null,
  }
}

const normalizeInputNumbers = (input: {
  mpn?: string | null
  partNumber?: string | null
  oemNumber?: string | null
}) => {
  const unifiedPartNumber = normalizeOptionalText(input.partNumber)
  const originalMpn =
    normalizeOptionalText(input.mpn) ??
    unifiedPartNumber ??
    normalizeOptionalText(input.oemNumber)
  const originalOemNumber =
    normalizeOptionalText(input.oemNumber) ??
    unifiedPartNumber ??
    normalizeOptionalText(input.mpn)

  return {
    originalMpn,
    originalOemNumber,
    normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
    normalizedOemNumber: originalOemNumber
      ? normalizePartNumber(originalOemNumber)
      : null,
  }
}

const findLocalPartUid = async (
  normalizedOemNumber: string | null,
  normalizedMpn: string | null,
  supplierBrand: string | null,
): Promise<string | null> => {
  const searchNumbers = [normalizedOemNumber, normalizedMpn].filter(
    (value): value is string => Boolean(value),
  )

  for (const numberNormalized of searchNumbers) {
    const matches = await db.partNumberIndex.findMany({
      where: {
        numberNormalized,
      },
      orderBy: { createdAt: "asc" },
      select: {
        partUid: true,
        brand: true,
        part: { select: { brandName: true } },
      },
    })
    const match = matches.find((candidate) =>
      brandsAreCompatible(supplierBrand, [
        candidate.brand,
        candidate.part.brandName,
      ]),
    )

    if (match) {
      return match.partUid
    }
  }

  return null
}

const findConfirmedLocalPartUid = async (
  normalizedOemNumber: string,
): Promise<string | null> => {
  const matches = await db.partNumberIndex.findMany({
    where: {
      numberNormalized: normalizedOemNumber,
      numberType: PartNumberType.oem,
    },
    orderBy: { createdAt: "asc" },
    select: {
      partUid: true,
      brand: true,
      part: { select: { brandName: true, source: true } },
    },
  })

  const match = matches.find(
    (candidate) =>
      !candidate.part.source.endsWith("_pending") &&
      candidate.part.source !== "supplier_pending",
  )

  if (match) {
    return match.partUid
  }

  const directMatches = await db.partMaster.findMany({
    where: { normalizedPartNumber: normalizedOemNumber },
    orderBy: { createdAt: "asc" },
    select: { partUid: true, brandName: true, source: true },
  })
  const directMatch = directMatches.find(
    (candidate) =>
      !candidate.source.endsWith("_pending") &&
      candidate.source !== "supplier_pending",
  )

  return directMatch?.partUid ?? null
}

const createPartNumberIndexIfMissing = async (input: {
  partUid: string
  numberOriginal: string | null | undefined
  numberType: PartNumberType
  brand?: string | null
  source: string
}) => {
  const numberOriginal = normalizeOptionalText(input.numberOriginal)
  if (!numberOriginal) {
    return
  }

  const numberNormalized = normalizePartNumber(numberOriginal)
  if (!numberNormalized) {
    return
  }

  const existing = await db.partNumberIndex.findFirst({
    where: {
      partUid: input.partUid,
      numberNormalized,
      numberType: input.numberType,
    },
    select: { id: true },
  })

  if (existing) {
    return
  }

  await db.partNumberIndex.create({
    data: {
      partUid: input.partUid,
      numberOriginal,
      numberNormalized,
      numberType: input.numberType,
      brand: normalizeOptionalText(input.brand),
      source: input.source,
    },
  })
}

const search17VinCandidates = async (
  queries: Array<string | null>,
): Promise<Vin17PartCandidate[]> => {
  const dedupedQueries = Array.from(
    new Set(queries.map(normalizeOptionalText).filter((value): value is string => Boolean(value))),
  )

  let hasSuccessfulSearch = false
  let lastError: unknown = null

  for (const query of dedupedQueries) {
    try {
      const candidates = await searchPartIn17Vin(query)
      hasSuccessfulSearch = true

      if (candidates.length > 0) {
        return candidates
      }
    } catch (error) {
      lastError = error
    }
  }

  if (hasSuccessfulSearch) {
    return []
  }

  if (lastError) {
    throw lastError
  }

  return []
}

const pick17VinCandidate = (
  candidates: Vin17PartCandidate[],
  normalizedOemNumber: string | null,
  normalizedMpn: string | null,
  supplierBrand: string | null,
) => {
  if (candidates.length === 0) {
    return { candidate: null, confident: false, matchError: null }
  }

  const expectedNumbers = [normalizedOemNumber, normalizedMpn].filter(
    (value): value is string => Boolean(value),
  )
  const exactNumberMatches = candidates.filter((candidate) => {
    const normalizedCandidate = candidate.partNumber
      ? normalizePartNumber(candidate.partNumber)
      : null
    return normalizedCandidate
      ? expectedNumbers.includes(normalizedCandidate)
      : false
  })

  if (exactNumberMatches.length === 0) {
    return {
      candidate: candidates[0],
      confident: false,
      matchError:
        "No exact match was found for the submitted OEM or MPN",
    }
  }

  // The supplier brand commonly describes an aftermarket manufacturer while
  // the submitted OEM number belongs to the vehicle manufacturer. An exact
  // OEM-number match is therefore authoritative and must not be rejected only
  // because those brand names differ.
  const exactOemMatches = normalizedOemNumber
    ? exactNumberMatches.filter((candidate) =>
        candidate.partNumber
          ? normalizePartNumber(candidate.partNumber) === normalizedOemNumber
          : false,
      )
    : []
  if (exactOemMatches.length > 0) {
    return {
      candidate: exactOemMatches[0],
      confident: true,
      matchError: null,
    }
  }

  const exactBrandMatches = exactNumberMatches.filter((candidate) =>
    brandsAreCompatible(supplierBrand, [candidate.brandName]),
  )

  if (exactBrandMatches.length === 0) {
    return {
      candidate: exactNumberMatches[0],
      confident: false,
      matchError:
        "The submitted part number matched, but the brand did not match",
    }
  }

  return {
    candidate: exactBrandMatches[0],
    confident: true,
    matchError: null,
  }
}

const findOrCreatePartMasterFrom17Vin = async (
  candidate: Vin17PartCandidate,
  uploaded: {
    originalPartName: string
    originalBrand: string | null
    originalMpn: string | null
    originalOemNumber: string | null
    category: string | null
  },
) => {
  const normalizedPartNumber = candidate.partNumber
    ? normalizePartNumber(candidate.partNumber)
    : uploaded.originalOemNumber
      ? normalizePartNumber(uploaded.originalOemNumber)
      : uploaded.originalMpn
        ? normalizePartNumber(uploaded.originalMpn)
        : null
  const groupId = candidate.groupId

  const existing =
    normalizedPartNumber &&
    (await db.partMaster.findFirst({
      where: {
        normalizedPartNumber,
        groupId,
      },
      select: { partUid: true },
    }))

  if (existing) {
    return existing.partUid
  }

  const partUid = makePartUid()
  await db.partMaster.create({
    data: {
      partUid,
      source: "17vin",
      sourcePartId: candidate.sourcePartId,
      partNumber: candidate.partNumber,
      normalizedPartNumber,
      partNumberOriginal: candidate.partNumberOriginal,
      brandName: candidate.brandName ?? uploaded.originalBrand,
      partName: candidate.partName ?? uploaded.originalPartName,
      category: candidate.category ?? uploaded.category,
      groupId: candidate.groupId,
      groupName: candidate.groupName,
      imageUrl: candidate.imageUrl,
      imageUrls: candidate.imageUrl ? [candidate.imageUrl] : [],
      raw17VinPartInfo: parseJson(candidate.raw),
    },
  })

  return partUid
}

const saveFitments = async (
  partUid: string,
  vehicles: Vin17VehicleCandidate[],
) => {
  for (const vehicle of vehicles) {
    if (vehicle.vin17ModelId) {
      const existing = await db.masterFitment.findFirst({
        where: {
          partUid,
          vin17ModelId: vehicle.vin17ModelId,
        },
        select: { id: true },
      })

      if (existing) {
        continue
      }
    } else {
      const existing = await db.masterFitment.findFirst({
        where: {
          partUid,
          brand: vehicle.brand,
          make: vehicle.make,
          model: vehicle.model,
          modelYear: vehicle.modelYear,
          engine: vehicle.engine,
        },
        select: { id: true },
      })

      if (existing) {
        continue
      }
    }

    await db.masterFitment.create({
      data: {
        partUid,
        source: "17vin",
        vin17ModelId: vehicle.vin17ModelId,
        brand: vehicle.brand,
        make: vehicle.make,
        model: vehicle.model,
        series: vehicle.series,
        modelYear: vehicle.modelYear,
        yearFrom: vehicle.yearFrom,
        yearTo: vehicle.yearTo,
        engine: vehicle.engine,
        engineNo: vehicle.engineNo,
        cc: vehicle.cc,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        bodyType: vehicle.bodyType,
        dateBegin: vehicle.dateBegin,
        dateEnd: vehicle.dateEnd,
        raw17VinVehicle: parseJson(vehicle.raw),
      },
    })
  }
}

const validateLookupInput = (input: SupplierPartLookupInput) => {
  const vendorSku = normalizeVendorSku(input.vendorSku)
  const numbers = normalizeInputNumbers(input)
  const brand = normalizeOptionalText(input.brand)
  const competitorPartNumber = normalizeOptionalText(input.competitorPartNumber)
  const competitorBrandName = normalizeOptionalText(input.competitorBrandName)

  if (!vendorSku) {
    throw new Error("Vendor SKU is required")
  }
  if (
    !numbers.originalMpn &&
    !numbers.originalOemNumber &&
    (!brand || !competitorPartNumber)
  ) {
    throw new Error(
      "Provide MPN / OEM number, or provide Brand Name and Competitor OEM Part Number",
    )
  }

  return {
    vendorSku,
    brand,
    competitorPartNumber,
    competitorBrandName,
    ...numbers,
  }
}

const partMasterSummary = (part: {
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
}) => ({
  partUid: part.partUid,
  partName: part.partName,
  partNumber: part.partNumber,
  brandName: part.brandName,
  category: part.category,
  source: part.source,
  imageUrls: part.imageUrls,
  imageKeys: part.imageKeys,
  badgeText: part.badgeText,
  heading: part.heading,
  description: part.description,
  keyFeatures: part.keyFeatures,
})

export async function lookupSupplierPart(
  supplierId: string,
  input: SupplierPartLookupInput,
): Promise<SupplierPartLookupResult> {
  let details = validateLookupInput(input)
  const existingSkuOffer = await db.supplierPart.findUnique({
    where: {
      supplierId_vendorSku: {
        supplierId,
        vendorSku: details.vendorSku,
      },
    },
  })

  let competitorResolution: BulkPartResolution | null = null
  if (!details.originalOemNumber && details.competitorPartNumber) {
    competitorResolution = await resolvePartFromCompetitor(details)
    if (
      existingSkuOffer?.partUid &&
      existingSkuOffer.partUid !== competitorResolution.partUid
    ) {
      throw new Error("This Vendor SKU is already assigned to another product")
    }
    details = {
      ...details,
      brand: competitorResolution.resolvedBrand ?? details.brand,
      originalOemNumber: competitorResolution.resolvedOemNumber,
      normalizedOemNumber: normalizePartNumber(
        competitorResolution.resolvedOemNumber,
      ),
    }
  }

  if (existingSkuOffer) {
    const submittedNumbers = new Set([
      details.normalizedMpn,
      details.normalizedOemNumber,
    ].filter((value): value is string => Boolean(value)))
    const existingNumbers = [
      existingSkuOffer.normalizedMpn,
      existingSkuOffer.normalizedOemNumber,
    ].filter((value): value is string => Boolean(value))
    if (
      existingNumbers.length > 0 &&
      !existingNumbers.some((value) => submittedNumbers.has(value))
    ) {
      throw new Error("This Vendor SKU is already assigned to another part number")
    }
  }
  const indexedPartUid = await findLocalPartUid(
    details.normalizedOemNumber,
    details.normalizedMpn,
    details.brand,
  )
  if (
    existingSkuOffer?.partUid &&
    indexedPartUid &&
    existingSkuOffer.partUid !== indexedPartUid
  ) {
    throw new Error("This Vendor SKU is already assigned to another product")
  }
  const localPartUid =
    competitorResolution?.partUid ??
    indexedPartUid ??
    existingSkuOffer?.partUid ??
    null

  if (localPartUid) {
    const [part, supplierOffer] = await Promise.all([
      db.partMaster.findUnique({ where: { partUid: localPartUid } }),
      existingSkuOffer
        ? Promise.resolve(existingSkuOffer)
        : db.supplierPart.findFirst({
            where: { supplierId, partUid: localPartUid },
            orderBy: { updatedAt: "desc" },
          }),
    ])

    if (part) {
      const supplierOfferRecord = supplierOffer
        ? await getSupplierPartById(supplierOffer.id)
        : null
      const hasCompleteProductContent =
        part.imageUrls.length > 0 &&
        part.keyFeatures.length > 0 &&
        Boolean(part.badgeText && part.heading && part.description)

      if (!hasCompleteProductContent) {
        return {
          exists: false,
          requiresProductDetails: true,
          part: partMasterSummary(part),
          supplierOffer: supplierOfferRecord,
          vin17Suggestion: {
            partNumber: part.partNumber,
            partName: part.partName,
            brandName: part.brandName,
            category: part.category,
            imageUrl: part.imageUrl,
          },
          message:
            "This part number exists, but its catalog images and content are incomplete.",
        }
      }

      return {
        exists: true,
        requiresProductDetails: false,
        part: partMasterSummary(part),
        supplierOffer: supplierOfferRecord,
        vin17Suggestion: null,
      }
    }
  }

  let candidates: Vin17PartCandidate[] = []
  let vin17Error: string | null = null
  try {
    candidates = await search17VinCandidates([
      details.originalOemNumber,
      details.originalMpn,
    ])
  } catch {
    vin17Error = "Unable to verify this part number right now"
  }
  const { candidate, confident, matchError } = pick17VinCandidate(
    candidates,
    details.normalizedOemNumber,
    details.normalizedMpn,
    details.brand,
  )

  return {
    exists: false,
    requiresProductDetails: true,
    part: null,
    supplierOffer: null,
    vin17Suggestion:
      candidate && confident
        ? {
            partNumber: candidate.partNumber,
            partName: candidate.partName,
            brandName: candidate.brandName,
            category: candidate.category,
            imageUrl: candidate.imageUrl,
          }
        : null,
    message:
      vin17Error ??
      matchError ??
      "No complete product exists yet. Complete the first-vendor product form.",
  }
}

const normalizeRequiredProductText = (value: unknown, label: string) => {
  const normalized = normalizeOptionalText(value)
  if (!normalized) {
    throw new Error(`${label} is required`)
  }
  return normalized
}

export async function createSupplierPart(
  supplierId: string,
  input: SupplierPartCreateInput,
) {
  let details = validateLookupInput(input)
  const price = parseMoney(input.price)
  const stock = parseStock(input.stock)
  let partUid = normalizeOptionalText(input.partUid)
  const completePartUid = normalizeOptionalText(input.completePartUid)
  let competitorResolution: BulkPartResolution | null = null
  if (!details.originalOemNumber && details.competitorPartNumber) {
    competitorResolution = await resolvePartFromCompetitor(details)
    if (partUid && partUid !== competitorResolution.partUid) {
      throw new Error("The selected product does not match the competitor OEM")
    }
    if (completePartUid && completePartUid !== competitorResolution.partUid) {
      throw new Error(
        "The product selected for completion does not match the competitor OEM",
      )
    }
    if (!completePartUid) {
      partUid = competitorResolution.partUid
    }
    details = {
      ...details,
      brand: competitorResolution.resolvedBrand ?? details.brand,
      originalOemNumber: competitorResolution.resolvedOemNumber,
      normalizedOemNumber: normalizePartNumber(
        competitorResolution.resolvedOemNumber,
      ),
    }
  }
  let master = partUid
    ? await db.partMaster.findUnique({ where: { partUid } })
    : null
  let mappingSource: SupplierPartMappingSource =
    competitorResolution?.mappingSource ?? SupplierPartMappingSource.local_db
  let requiresAdminApproval = false
  const existingSkuOffer = await db.supplierPart.findUnique({
    where: {
      supplierId_vendorSku: {
        supplierId,
        vendorSku: details.vendorSku,
      },
    },
  })

  if (master) {
    const matchingUid = await findLocalPartUid(
      details.normalizedOemNumber,
      details.normalizedMpn,
      details.brand,
    )
    if (matchingUid !== master.partUid) {
      throw new Error("The selected product does not match the submitted MPN / OEM number")
    }
  } else {
    const product = input.product
    if (!product) {
      throw new Error("Complete product details are required for the first vendor")
    }

    const partName = normalizeRequiredProductText(product.partName, "Product name")
    const category = normalizeRequiredProductText(product.category, "Category")
    const badgeText = normalizeRequiredProductText(product.badgeText, "Badge text")
    const heading = normalizeRequiredProductText(product.heading, "Heading")
    const description = normalizeRequiredProductText(product.description, "Description")
    const keyFeatures = Array.from(
      new Set(product.keyFeatures.map(normalizeText).filter(Boolean)),
    ).slice(0, 12)
    const imageUrls = Array.from(
      new Set(product.imageUrls.map(normalizeText).filter(Boolean)),
    ).slice(0, 8)
    const imageKeys = Array.from(
      new Set(product.imageKeys.map(normalizeText).filter(Boolean)),
    ).slice(0, 8)

    if (keyFeatures.length === 0) {
      throw new Error("At least one key feature is required")
    }
    if (
      imageUrls.length === 0 ||
      imageUrls.length !== imageKeys.length ||
      imageKeys.some((key) => !key.startsWith("supplier-products/"))
    ) {
      throw new Error("At least one uploaded product image is required")
    }

    const localPartUid =
      competitorResolution?.partUid ??
      await findLocalPartUid(
        details.normalizedOemNumber,
        details.normalizedMpn,
        details.brand,
      )
    if (localPartUid) {
      if (completePartUid && completePartUid !== localPartUid) {
        throw new Error("The product selected for completion does not match the submitted identifiers")
      }
      partUid = localPartUid
      const localMaster = await db.partMaster.findUnique({
        where: { partUid },
        select: { source: true },
      })
      master = await db.partMaster.update({
        where: { partUid },
        data: {
          source: localMaster?.source.endsWith("_pending")
            ? localMaster.source
            : `${localMaster?.source ?? "supplier"}_pending`,
          partName,
          category,
          imageUrl: imageUrls[0],
          imageUrls,
          imageKeys,
          badgeText,
          heading,
          description,
          keyFeatures,
        },
      })
    } else {
      let candidates: Vin17PartCandidate[] = []
      try {
        candidates = await search17VinCandidates([
          details.originalOemNumber,
          details.originalMpn,
        ])
      } catch {
        // Complete first-vendor details are sufficient when automatic verification is unavailable.
      }
      const { candidate, confident } = pick17VinCandidate(
        candidates,
        details.normalizedOemNumber,
        details.normalizedMpn,
        details.brand,
      )
      const vinCandidate = candidate && confident ? candidate : null
      requiresAdminApproval = !vinCandidate
      const primaryPartNumber = normalizeRequiredProductText(
        vinCandidate?.partNumber ??
          details.originalOemNumber ??
          details.originalMpn,
        "Part number",
      )
      partUid = makePartUid()
      mappingSource = vinCandidate
        ? SupplierPartMappingSource.vin17
        : SupplierPartMappingSource.manual
      master = await db.partMaster.create({
        data: {
          partUid,
          source: vinCandidate ? "17vin_supplier" : "supplier_pending",
          sourcePartId: vinCandidate?.sourcePartId,
          partNumber: primaryPartNumber,
          normalizedPartNumber: normalizePartNumber(primaryPartNumber),
          partNumberOriginal:
            vinCandidate?.partNumberOriginal ?? details.originalOemNumber,
          brandName: vinCandidate?.brandName ?? details.brand,
          partName,
          category,
          groupId: vinCandidate?.groupId,
          groupName: vinCandidate?.groupName,
          imageUrl: imageUrls[0],
          imageUrls,
          imageKeys,
          badgeText,
          heading,
          description,
          keyFeatures,
          raw17VinPartInfo: parseJson(vinCandidate?.raw),
        },
      })

      if (vinCandidate?.partNumber && vinCandidate.groupId) {
        const vehicles = await get17VinApplicableModels(
          vinCandidate.partNumber,
          vinCandidate.groupId,
        )
        await saveFitments(partUid, vehicles)
      }
    }
  }

  if (!master || !partUid) {
    throw new Error("Unable to resolve the master product")
  }
  if (existingSkuOffer?.partUid && existingSkuOffer.partUid !== partUid) {
    throw new Error("This Vendor SKU is already assigned to another product")
  }

  if (!requiresAdminApproval) {
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: details.originalOemNumber,
      numberType: PartNumberType.oem,
      brand: details.brand,
      source: "supplier_upload",
    })
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: details.originalMpn,
      numberType: PartNumberType.mpn,
      brand: details.brand,
      source: "supplier_upload",
    })
  }

  const existingOemOffer = await findSupplierPartBySupplierOem(
    supplierId,
    details.normalizedOemNumber,
    existingSkuOffer?.id,
  )
  if (existingSkuOffer && existingOemOffer) {
    throw new Error(
      `This OEM is already used by this supplier under SKU ${existingOemOffer.vendorSku ?? "unknown"}`,
    )
  }

  const existingPartOffer = await db.supplierPart.findFirst({
    where: { supplierId, partUid },
    orderBy: { updatedAt: "desc" },
  })
  const existingOffer = existingSkuOffer ?? existingOemOffer ?? existingPartOffer
  const offerData = {
    vendorSku: details.vendorSku,
    originalPartName: master.partName ?? master.heading ?? "Supplier product",
    originalBrand: details.brand,
    originalMpn: details.originalMpn,
    originalOemNumber: details.originalOemNumber,
    normalizedMpn: details.normalizedMpn,
    normalizedOemNumber: details.normalizedOemNumber,
    price,
    stock,
    currency: DEFAULT_CURRENCY,
    category: master.category,
    partUid,
    competitorPartNumber: details.competitorPartNumber,
    competitorBrandName: details.competitorBrandName,
    mappingStatus: requiresAdminApproval
      ? SupplierPartMappingStatus.pending_review
      : SupplierPartMappingStatus.mapped,
    mappingSource: requiresAdminApproval ? null : mappingSource,
    mappingError: requiresAdminApproval
      ? "First-vendor product details require admin approval"
      : null,
    rawUploadData: parseJson(input.rawUploadData),
  }
  const supplierPart = existingOffer
    ? await db.supplierPart.update({
        where: { id: existingOffer.id },
        data: offerData,
      })
    : await db.supplierPart.create({
        data: { supplierId, ...offerData },
      })

  return getSupplierPartById(supplierPart.id)
}

type BulkPartResolution = {
  partUid: string
  mappingSource: SupplierPartMappingSource
  resolvedOemNumber: string
  resolvedBrand: string | null
}

const resolveConfirmedBulkPart = async (
  row: SupplierBulkProductRow,
): Promise<BulkPartResolution> => {
  const normalizedOemNumber = normalizePartNumber(row.oemNumber)
  if (!normalizedOemNumber) {
    throw new Error("OEM Part Number is required")
  }

  const brand = normalizeOptionalText(row.brand)
  const localPartUid = await findConfirmedLocalPartUid(normalizedOemNumber)
  if (localPartUid) {
    return {
      partUid: localPartUid,
      mappingSource: SupplierPartMappingSource.local_db,
      resolvedOemNumber: row.oemNumber,
      resolvedBrand: brand,
    }
  }

  const candidates = await search17VinCandidates([row.oemNumber])
  const { candidate, confident, matchError } = pick17VinCandidate(
    candidates,
    normalizedOemNumber,
    null,
    brand,
  )
  if (!candidate || !confident) {
    throw new Error(
      matchError ?? "No exact OEM match was found",
    )
  }

  const vehicles =
    candidate.partNumber && candidate.groupId
      ? await get17VinApplicableModels(candidate.partNumber, candidate.groupId)
      : []
  const partUid = await findOrCreatePartMasterFrom17Vin(candidate, {
    originalPartName: candidate.partName ?? `OEM ${row.oemNumber}`,
    originalBrand: brand,
    originalMpn: normalizeOptionalText(row.mpn),
    originalOemNumber: row.oemNumber,
    category: candidate.category,
  })

  await saveFitments(partUid, vehicles)
  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: row.oemNumber,
    numberType: PartNumberType.oem,
    brand: candidate.brandName ?? brand,
    source: "17vin_bulk_upload",
  })

  return {
    partUid,
    mappingSource: SupplierPartMappingSource.vin17,
    resolvedOemNumber: row.oemNumber,
    resolvedBrand: brand ?? candidate.brandName,
  }
}

const findLocalEquivalentOem = async (
  normalizedCompetitorOem: string,
  supplierBrand: string,
): Promise<{ partUid: string; oemNumber: string } | null> => {
  const [indexedCompetitorParts, directCompetitorParts] = await Promise.all([
    db.partNumberIndex.findMany({
      where: { numberNormalized: normalizedCompetitorOem },
      select: { partUid: true },
    }),
    db.partMaster.findMany({
      where: { normalizedPartNumber: normalizedCompetitorOem },
      select: { partUid: true },
    }),
  ])
  const partUids = Array.from(
    new Set([
      ...indexedCompetitorParts.map((part) => part.partUid),
      ...directCompetitorParts.map((part) => part.partUid),
    ]),
  )
  if (partUids.length === 0) {
    return null
  }

  const relatedNumbers = await db.partNumberIndex.findMany({
    where: { partUid: { in: partUids } },
    orderBy: { createdAt: "asc" },
    select: {
      partUid: true,
      numberOriginal: true,
      numberType: true,
      brand: true,
      part: { select: { brandName: true, source: true } },
    },
  })
  const confirmedNumbers = relatedNumbers.filter(
    (candidate) =>
      !candidate.part.source.endsWith("_pending") &&
      candidate.part.source !== "supplier_pending" &&
      brandsAreCompatible(supplierBrand, [
        candidate.brand,
        candidate.part.brandName,
      ]),
  )
  const preferredNumber =
    confirmedNumbers.find(
      (candidate) => candidate.numberType === PartNumberType.oem,
    ) ?? confirmedNumbers[0]

  if (preferredNumber) {
    return {
      partUid: preferredNumber.partUid,
      oemNumber: preferredNumber.numberOriginal,
    }
  }

  const directBrandCandidates = await db.partMaster.findMany({
    where: {
      partUid: { in: partUids },
      source: { not: "supplier_pending" },
      NOT: { source: { endsWith: "_pending" } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      partUid: true,
      partNumber: true,
      brandName: true,
    },
  })
  const directBrandMatch = directBrandCandidates.find((candidate) =>
    brandsAreCompatible(supplierBrand, [candidate.brandName]),
  )

  return directBrandMatch?.partNumber
    ? {
        partUid: directBrandMatch.partUid,
        oemNumber: directBrandMatch.partNumber,
      }
    : null
}

const resolvePartFromCompetitor = async (
  row: Pick<
    SupplierBulkProductRow,
    "brand" | "competitorPartNumber" | "competitorBrandName" | "mpn"
  >,
): Promise<BulkPartResolution> => {
  const supplierBrand = normalizeOptionalText(row.brand)
  const competitorOem = normalizeOptionalText(row.competitorPartNumber)
  const competitorBrand = normalizeOptionalText(row.competitorBrandName)

  if (!supplierBrand) {
    throw new Error(
      "Brand Name is required when OEM Part Number is missing",
    )
  }
  if (!competitorOem) {
    throw new Error(
      "Competitor OEM Part Number is required when OEM Part Number is missing",
    )
  }

  const normalizedCompetitorOem = normalizePartNumber(competitorOem)
  const localEquivalent = await findLocalEquivalentOem(
    normalizedCompetitorOem,
    supplierBrand,
  )
  if (localEquivalent) {
    return {
      partUid: localEquivalent.partUid,
      mappingSource: SupplierPartMappingSource.local_db,
      resolvedOemNumber: localEquivalent.oemNumber,
      resolvedBrand: supplierBrand,
    }
  }

  const competitorCandidates = await search17VinCandidates([competitorOem])
  const {
    candidate: competitorCandidate,
    confident,
    matchError,
  } = pick17VinCandidate(
    competitorCandidates,
    normalizedCompetitorOem,
    null,
    competitorBrand,
  )
  if (!competitorCandidate || !confident || !competitorCandidate.partNumber) {
    throw new Error(
      matchError ??
        "No exact competitor OEM match was found",
    )
  }
  if (!competitorCandidate.groupId) {
    throw new Error(
      "The competitor OEM was found, but product group details were missing",
    )
  }

  const interchange = await get17VinInterchanges(
    competitorCandidate.partNumber,
    competitorCandidate.groupId,
  )
  const equivalentCandidates = [
    ...interchange.oeInterchanges,
    ...interchange.factoryInterchanges,
  ]
  const supplierCandidate = equivalentCandidates.find(
    (candidate) =>
      Boolean(candidate.partNumber) &&
      brandsAreCompatible(supplierBrand, [candidate.brandName]),
  )
  if (!supplierCandidate?.partNumber) {
    throw new Error(
      `No equivalent OEM was found for brand ${supplierBrand}`,
    )
  }

  const resolvedOemNumber =
    supplierCandidate.partNumberOriginal ?? supplierCandidate.partNumber
  const normalizedResolvedOem = normalizePartNumber(resolvedOemNumber)
  const localPartUid = await findConfirmedLocalPartUid(normalizedResolvedOem)
  if (localPartUid) {
    await createPartNumberIndexIfMissing({
      partUid: localPartUid,
      numberOriginal: competitorOem,
      numberType: PartNumberType.oem,
      brand: competitorBrand ?? competitorCandidate.brandName,
      source: "17vin_interchange_bulk_upload",
    })
    return {
      partUid: localPartUid,
      mappingSource: SupplierPartMappingSource.local_db,
      resolvedOemNumber,
      resolvedBrand: supplierBrand,
    }
  }

  const partUid = await findOrCreatePartMasterFrom17Vin(supplierCandidate, {
    originalPartName:
      supplierCandidate.partName ??
      competitorCandidate.partName ??
      `OEM ${resolvedOemNumber}`,
    originalBrand: supplierBrand,
    originalMpn: normalizeOptionalText(row.mpn),
    originalOemNumber: resolvedOemNumber,
    category:
      supplierCandidate.category ??
      competitorCandidate.category ??
      interchange.part?.category ??
      competitorCandidate.partName ??
      interchange.part?.partName ??
      competitorCandidate.groupName,
  })
  const vehicles = supplierCandidate.groupId
    ? await get17VinApplicableModels(
        supplierCandidate.partNumber,
        supplierCandidate.groupId,
      )
    : []
  await saveFitments(partUid, vehicles)
  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: resolvedOemNumber,
    numberType: PartNumberType.oem,
    brand: supplierCandidate.brandName ?? supplierBrand,
    source: "17vin_interchange_bulk_upload",
  })
  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: competitorOem,
    numberType: PartNumberType.oem,
    brand: competitorBrand ?? competitorCandidate.brandName,
    source: "17vin_interchange_bulk_upload",
  })

  return {
    partUid,
    mappingSource: SupplierPartMappingSource.vin17,
    resolvedOemNumber,
    resolvedBrand: supplierBrand,
  }
}

const mapWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  )
  return results
}

class SupplierImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupplierImageUploadError"
  }
}

const normalizeImageContentType = (value: string | null): string =>
  value?.split(";")[0]?.trim().toLowerCase() ?? ""

const sanitizeS3PathSegment = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return sanitized.slice(0, 80) || "sku"
}

const isBlockedExternalImageHost = (hostname: string): boolean => {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase()

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    (normalized.includes(":") &&
      (normalized.startsWith("fc") || normalized.startsWith("fd")))
  )
}

const fetchExternalSupplierImage = async (
  imageUrl: string,
  imageIndex: number,
) => {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    throw new SupplierImageUploadError(`Image ${imageIndex}: invalid image URL`)
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: image URL must use HTTP or HTTPS`,
    )
  }

  if (isBlockedExternalImageHost(parsedUrl.hostname)) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: local or private image URLs are not allowed`,
    )
  }

  const abortController = new AbortController()
  const timeout = setTimeout(
    () => abortController.abort(),
    SUPPLIER_IMAGE_FETCH_TIMEOUT_MS,
  )

  let response: Response
  try {
    response = await fetch(parsedUrl.toString(), {
      signal: abortController.signal,
      redirect: "follow",
    })
  } catch (error) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: unable to download image${
        error instanceof Error ? ` (${error.message})` : ""
      }`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: image download failed with HTTP ${response.status}`,
    )
  }

  const contentType = normalizeImageContentType(
    response.headers.get("content-type"),
  )
  const extension = SUPPORTED_SUPPLIER_IMAGE_TYPES[contentType]
  if (!extension) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: only JPG, PNG, or WebP images are supported`,
    )
  }

  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  )
  if (
    Number.isFinite(contentLength) &&
    contentLength > SUPPLIER_IMAGE_MAX_BYTES
  ) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: image must be no larger than 5 MB`,
    )
  }

  let body: Buffer
  try {
    body = Buffer.from(await response.arrayBuffer())
  } catch (error) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: unable to read image data${
        error instanceof Error ? ` (${error.message})` : ""
      }`,
    )
  }
  if (body.byteLength > SUPPLIER_IMAGE_MAX_BYTES) {
    throw new SupplierImageUploadError(
      `Image ${imageIndex}: image must be no larger than 5 MB`,
    )
  }

  return { body, contentType, extension }
}

const uploadSupplierImageUrlsToS3 = async ({
  supplierId,
  vendorSku,
  imageUrls,
}: {
  supplierId: string
  vendorSku: string
  imageUrls: string[]
}): Promise<string[]> => {
  const uniqueImageUrls = Array.from(
    new Set(imageUrls.map(normalizeText).filter(Boolean)),
  )

  if (!uniqueImageUrls.length) {
    return []
  }

  const safeSku = sanitizeS3PathSegment(vendorSku)
  const indexedImageUrls = uniqueImageUrls.map((imageUrl, index) => ({
    imageUrl,
    index,
  }))

  return mapWithConcurrency(
    indexedImageUrls,
    SUPPLIER_IMAGE_UPLOAD_CONCURRENCY,
    async ({ imageUrl, index }) => {
      const imageNumber = index + 1
      const image = await fetchExternalSupplierImage(imageUrl, imageNumber)
      let uploaded: Awaited<ReturnType<typeof uploadObjectToS3>>

      try {
        const key = [
          "supplier-products",
          supplierId,
          "bulk",
          safeSku,
          `${Date.now()}-${crypto.randomUUID()}.${image.extension}`,
        ].join("/")
        uploaded = await uploadObjectToS3({
          key,
          body: image.body,
          contentType: image.contentType,
        })
      } catch (error) {
        throw new SupplierImageUploadError(
          `Image ${imageNumber}: unable to upload image to S3${
            error instanceof Error ? ` (${error.message})` : ""
          }`,
        )
      }

      return uploaded.objectUrl
    },
  )
}

const withUploadedSupplierImageUrls = async (
  supplierId: string,
  vendorSku: string,
  row: SupplierBulkProductRow,
): Promise<SupplierBulkProductRow> => {
  if (!row.imageUrls?.length) {
    return row
  }

  return {
    ...row,
    imageUrls: await uploadSupplierImageUrlsToS3({
      supplierId,
      vendorSku,
      imageUrls: row.imageUrls,
    }),
  }
}

const hasSupplierProductInfo = (row: SupplierBulkProductRow) =>
  Boolean(
    normalizeOptionalText(row.productName) &&
      normalizeOptionalText(row.mpn ?? row.oemNumber),
  )

const hasUploadedValue = (value: unknown) =>
  !(value === null || value === undefined || (typeof value === "string" && value.trim() === ""))

const isSupplierOemConflictError = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.message.startsWith("This OEM is already used") ||
    error.message.startsWith("This supplier OEM is already mapped"))

const upsertPendingSupplierProductInfo = async (
  supplierId: string,
  row: SupplierBulkProductRow,
  vendorSku: string,
  reason: string,
) => {
  const existingSkuOffer = await db.supplierPart.findUnique({
    where: {
      supplierId_vendorSku: {
        supplierId,
        vendorSku,
      },
    },
  })
  const productName =
    normalizeOptionalText(row.productName) ??
    normalizeOptionalText(row.shortDescription) ??
    normalizeOptionalText(row.longDescription) ??
    `Supplier SKU ${vendorSku}`
  const originalMpn = normalizeOptionalText(row.mpn) ?? normalizeOptionalText(row.oemNumber)
  const originalOemNumber = normalizeOptionalText(row.oemNumber)
  const uploadedPrice = hasUploadedValue(row.price)
  const uploadedStock = hasUploadedValue(row.stock)
  const commonData = {
    vendorSku,
    originalPartName: productName,
    originalBrand: normalizeOptionalText(row.brand),
    originalMpn,
    originalOemNumber,
    normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
    normalizedOemNumber: originalOemNumber
      ? normalizePartNumber(originalOemNumber)
      : null,
    category: normalizeOptionalText(row.grade) ?? normalizeOptionalText(row.condition),
    oemSupersessionNumbers: row.oemSupersessionNumbers ?? [],
    competitorPartNumber: normalizeOptionalText(row.competitorPartNumber),
    competitorBrandName: normalizeOptionalText(row.competitorBrandName),
    hsCode: normalizeOptionalText(row.hsCode),
    ...(row.imageUrls?.length ? { supplierImageUrls: row.imageUrls } : {}),
    rawUploadData: parseJson(row.rawUploadData),
  }
  const existingOemOffer = existingSkuOffer
    ? null
    : await findSupplierPartBySupplierOem(
        supplierId,
        commonData.normalizedOemNumber,
      )
  const existingOffer = existingSkuOffer ?? existingOemOffer
  const pendingData =
    existingOffer?.partUid
      ? {}
      : {
          mappingStatus: SupplierPartMappingStatus.pending_review,
          mappingSource: null,
          mappingError: reason,
        }

  const supplierPart = existingOffer
    ? await db.supplierPart.update({
        where: { id: existingOffer.id },
        data: {
          ...commonData,
          ...(uploadedPrice ? { price: parseMoney(row.price ?? 0) } : {}),
          ...(uploadedStock ? { stock: parseStock(row.stock ?? 0) } : {}),
          ...pendingData,
        },
      })
    : await db.supplierPart.create({
        data: {
          supplierId,
          ...commonData,
          price: parseMoney(uploadedPrice ? row.price ?? 0 : 0),
          stock: parseStock(uploadedStock ? row.stock ?? 0 : 0),
          currency: DEFAULT_CURRENCY,
          mappingStatus: SupplierPartMappingStatus.pending_review,
          mappingSource: null,
          mappingError: reason,
        },
      })

  return getSupplierPartById(supplierPart.id)
}

export async function importSupplierPartsBulk(
  supplierId: string,
  rows: SupplierBulkProductRow[],
) {
  const seenSkus = new Set<string>()
  const seenOemNumbers = new Map<string, string>()
  const resolutionByLookup = new Map<string, Promise<BulkPartResolution>>()

  const results = await mapWithConcurrency(rows, 5, async (row) => {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const oemNumber = normalizeOptionalText(row.oemNumber)
    const supplierBrand = normalizeOptionalText(row.brand)
    const competitorOem = normalizeOptionalText(row.competitorPartNumber)
    const competitorBrand = normalizeOptionalText(row.competitorBrandName)
    const hasProductInfo = hasSupplierProductInfo(row)
    let rowForPersistence = row

    if (!vendorSku) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        brand: supplierBrand,
        oemNumber: oemNumber ?? "",
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        reason: "Vendor SKU Number is required",
      }
    }
    if (!oemNumber && (!supplierBrand || !competitorOem) && !hasProductInfo) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        brand: supplierBrand,
        oemNumber: "",
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        reason:
          "Provide OEM Part Number, or provide Brand Name and Competitor OEM Part Number",
      }
    }
    if (seenSkus.has(vendorSku)) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        brand: supplierBrand,
        oemNumber: oemNumber ?? "",
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        reason: "Duplicate Vendor SKU Number in this file",
      }
    }
    const normalizedInputOemNumber = oemNumber
      ? normalizePartNumber(oemNumber)
      : null
    if (normalizedInputOemNumber) {
      const duplicateSku = seenOemNumbers.get(normalizedInputOemNumber)
      if (duplicateSku && duplicateSku !== vendorSku) {
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: oemNumber ?? "",
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason: `Duplicate OEM Part Number in this file; already used by SKU ${duplicateSku}`,
        }
      }
      seenOemNumbers.set(normalizedInputOemNumber, vendorSku)
    }
    seenSkus.add(vendorSku)

    try {
      rowForPersistence = await withUploadedSupplierImageUrls(
        supplierId,
        vendorSku,
        row,
      )

      if (!oemNumber && (!supplierBrand || !competitorOem)) {
        await upsertPendingSupplierProductInfo(
          supplierId,
          rowForPersistence,
          vendorSku,
          "Product info uploaded; MPN/OEM is pending admin mapping",
        )
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: oemNumber ?? "",
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason: "Product was not confirmed in the local catalog or 17VIN",
        }
      }

      const lookupKey = oemNumber
        ? `oem:${normalizePartNumber(oemNumber)}:${normalizeBrandToken(supplierBrand ?? "")}`
        : `competitor:${normalizePartNumber(competitorOem ?? "")}:${normalizeBrandToken(supplierBrand ?? "")}:${normalizeBrandToken(competitorBrand ?? "")}`
      let resolutionPromise = resolutionByLookup.get(lookupKey)
      if (!resolutionPromise) {
        resolutionPromise = oemNumber
          ? resolveConfirmedBulkPart({ ...row, oemNumber })
          : resolvePartFromCompetitor(row)
        resolutionByLookup.set(lookupKey, resolutionPromise)
      }
      const resolution = await resolutionPromise
      const resolvedOemNumber = resolution.resolvedOemNumber
      const normalizedOemNumber = normalizePartNumber(resolvedOemNumber)
      const duplicateResolvedSku = seenOemNumbers.get(normalizedOemNumber)
      if (duplicateResolvedSku && duplicateResolvedSku !== vendorSku) {
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: resolvedOemNumber,
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason: `Duplicate OEM Part Number in this file; already used by SKU ${duplicateResolvedSku}`,
        }
      }
      seenOemNumbers.set(normalizedOemNumber, vendorSku)
      const master = await db.partMaster.findUniqueOrThrow({
        where: { partUid: resolution.partUid },
      })
      const uploadedPrice = hasUploadedValue(row.price)
      const uploadedStock = hasUploadedValue(row.stock)
      const originalMpn = normalizeOptionalText(row.mpn)
      const uploadedProductName = normalizeOptionalText(row.productName)
      const uploadedCategory = normalizeOptionalText(row.category)
      const originalPartName =
        uploadedProductName ?? master.partName ?? `OEM ${resolvedOemNumber}`
      const existingSkuOffer = await db.supplierPart.findUnique({
        where: { supplierId_vendorSku: { supplierId, vendorSku } },
        select: { id: true, vendorSku: true, partUid: true },
      })
      const existingOemOffer = await findSupplierPartBySupplierOem(
        supplierId,
        normalizedOemNumber,
        existingSkuOffer?.id,
      )
      if (existingSkuOffer && existingOemOffer) {
        throw new Error(
          `This OEM is already used by this supplier under SKU ${existingOemOffer.vendorSku ?? "unknown"}`,
        )
      }
      const existingOffer = existingSkuOffer ?? existingOemOffer
      if (existingOffer?.partUid && existingOffer.partUid !== resolution.partUid) {
        throw new Error(
          "This supplier OEM is already mapped to another product",
        )
      }

      const createData = {
        supplierId,
        vendorSku,
        partUid: resolution.partUid,
        originalPartName,
        originalBrand: resolution.resolvedBrand ?? master.brandName,
        originalMpn,
        originalOemNumber: resolvedOemNumber,
        normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
        normalizedOemNumber,
        price: parseMoney(uploadedPrice ? row.price ?? 0 : 0),
        stock: parseStock(uploadedStock ? row.stock ?? 0 : 0),
        currency: DEFAULT_CURRENCY,
        category: uploadedCategory ?? master.category,
        oemSupersessionNumbers: row.oemSupersessionNumbers ?? [],
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        hsCode: normalizeOptionalText(row.hsCode),
        supplierImageUrls: rowForPersistence.imageUrls ?? [],
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource: resolution.mappingSource,
        mappingError: null,
        rawUploadData: parseJson(row.rawUploadData),
      }
      const updateData = {
        vendorSku,
        partUid: resolution.partUid,
        originalPartName,
        originalBrand: resolution.resolvedBrand ?? master.brandName,
        originalMpn,
        originalOemNumber: resolvedOemNumber,
        normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
        normalizedOemNumber,
        ...(uploadedPrice ? { price: parseMoney(row.price ?? 0) } : {}),
        ...(uploadedStock ? { stock: parseStock(row.stock ?? 0) } : {}),
        currency: DEFAULT_CURRENCY,
        category: uploadedCategory ?? master.category,
        oemSupersessionNumbers: row.oemSupersessionNumbers ?? [],
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        hsCode: normalizeOptionalText(row.hsCode),
        ...(rowForPersistence.imageUrls?.length
          ? { supplierImageUrls: rowForPersistence.imageUrls }
          : {}),
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource: resolution.mappingSource,
        mappingError: null,
        rawUploadData: parseJson(row.rawUploadData),
      }
      const supplierPart = existingOffer
        ? await db.supplierPart.update({
            where: { id: existingOffer.id },
            data: updateData,
          })
        : await db.supplierPart.create({ data: createData })

      return {
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku,
        brand: resolution.resolvedBrand,
        oemNumber: resolvedOemNumber,
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        mappingSource: resolution.mappingSource,
        part: await getSupplierPartById(supplierPart.id),
      }
    } catch (error) {
      if (error instanceof SupplierImageUploadError) {
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: oemNumber ?? "",
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason: error.message,
        }
      }
      if (isSupplierOemConflictError(error)) {
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: oemNumber ?? "",
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason: error.message,
        }
      }
      if (hasProductInfo) {
        const reason =
          error instanceof Error ? error.message : "Unable to confirm this OEM"
        await upsertPendingSupplierProductInfo(
          supplierId,
          rowForPersistence,
          vendorSku,
          reason,
        )
        return {
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: supplierBrand,
          oemNumber: oemNumber ?? "",
          competitorPartNumber: competitorOem,
          competitorBrandName: competitorBrand,
          reason,
        }
      }
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        brand: supplierBrand,
        oemNumber: oemNumber ?? "",
        competitorPartNumber: competitorOem,
        competitorBrandName: competitorBrand,
        reason:
          error instanceof Error ? error.message : "Unable to confirm this OEM",
      }
    }
  })

  const mapped = results.filter((result) => result.ok)
  const unmapped = results.filter((result) => !result.ok)
  return {
    totalRows: rows.length,
    mappedCount: mapped.length,
    localMappedCount: mapped.filter(
      (result) => result.mappingSource === SupplierPartMappingSource.local_db,
    ).length,
    vin17MappedCount: mapped.filter(
      (result) => result.mappingSource === SupplierPartMappingSource.vin17,
    ).length,
    unmappedCount: unmapped.length,
    mappedParts: mapped.map((result) => result.part),
    unmapped,
  }
}

export async function updateSupplierPartImagesBulk(
  supplierId: string,
  rows: SupplierBulkImageRow[],
) {
  const results = []
  const resolveSupplierPart = await createSupplierPartSkuResolver(supplierId)

  for (const row of rows) {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const supplierPart = resolveSupplierPart(vendorSku)

    if (!supplierPart) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason: "No mapped product exists for this supplier SKU",
      })
      continue
    }

    try {
      const supplierImageUrls = await uploadSupplierImageUrlsToS3({
        supplierId,
        vendorSku: normalizeVendorSku(supplierPart.vendorSku ?? vendorSku),
        imageUrls: [row.primaryImageUrl, ...row.galleryImageUrls],
      })

      await db.supplierPart.update({
        where: { id: supplierPart.id },
        data: {
          supplierImageUrls,
        },
      })
      results.push({
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku,
        part: await getSupplierPartById(supplierPart.id),
      })
    } catch (error) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason:
          error instanceof Error ? error.message : "Unable to upload images to S3",
      })
    }
  }

  return {
    totalRows: rows.length,
    updatedCount: results.filter((result) => result.ok).length,
    unmatchedCount: results.filter((result) => !result.ok).length,
    updatedParts: results
      .filter((result) => result.ok)
      .map((result) => result.part),
    unmatched: results.filter((result) => !result.ok),
  }
}

export async function updateSupplierPartStockBulk(
  supplierId: string,
  rows: SupplierBulkStockRow[],
) {
  const results = []
  const resolveSupplierPart = await createSupplierPartSkuResolver(supplierId)

  for (const row of rows) {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const warehouseId = normalizeOptionalText(row.warehouseId)

    try {
      if (!vendorSku) {
        throw new Error("SKU is required")
      }
      if (!warehouseId) {
        throw new Error("Warehouse ID is required")
      }

      const quantity = parseNonNegativeWholeNumber(row.quantity, "Quantity")
      const lowStockThreshold = parseOptionalNonNegativeWholeNumber(
        row.lowStockThreshold,
        "Low Stock Threshold",
      )
      const supplierPart = resolveSupplierPart(vendorSku)

      if (!supplierPart) {
        results.push({
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          reason: "No mapped product exists for this supplier SKU",
        })
        continue
      }

      const matchedVendorSku = normalizeVendorSku(supplierPart.vendorSku ?? vendorSku)

      await db.supplierPartStock.upsert({
        where: {
          supplierId_vendorSku_warehouseId: {
            supplierId,
            vendorSku: matchedVendorSku,
            warehouseId,
          },
        },
        create: {
          supplierId,
          supplierPartId: supplierPart.id,
          vendorSku: matchedVendorSku,
          warehouseId,
          quantity,
          leadTime: normalizeOptionalText(row.leadTime),
          lowStockThreshold,
          rawUploadData: parseJson(row.rawUploadData),
        },
        update: {
          supplierPartId: supplierPart.id,
          quantity,
          leadTime: normalizeOptionalText(row.leadTime),
          lowStockThreshold,
          rawUploadData: parseJson(row.rawUploadData),
        },
      })

      const stockTotal = await db.supplierPartStock.aggregate({
        where: { supplierId, vendorSku: matchedVendorSku },
        _sum: { quantity: true },
      })
      await db.supplierPart.update({
        where: { id: supplierPart.id },
        data: { stock: stockTotal._sum.quantity ?? 0 },
      })

      results.push({
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku: matchedVendorSku,
        part: await getSupplierPartById(supplierPart.id),
      })
    } catch (error) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason:
          error instanceof Error ? error.message : "Unable to update stock",
      })
    }
  }

  return {
    totalRows: rows.length,
    updatedCount: results.filter((result) => result.ok).length,
    unmatchedCount: results.filter((result) => !result.ok).length,
    updatedParts: results
      .filter((result) => result.ok)
      .map((result) => result.part),
    unmatched: results.filter((result) => !result.ok),
  }
}

export async function updateSupplierPartPricingBulk(
  supplierId: string,
  rows: SupplierBulkPricingRow[],
) {
  const results = []
  const resolveSupplierPart = await createSupplierPartSkuResolver(supplierId)

  for (const row of rows) {
    const vendorSku = normalizeVendorSku(row.vendorSku)

    try {
      if (!vendorSku) {
        throw new Error("SKU is required")
      }

      const basePrice = parseOptionalMoney(row.basePrice)
      const discountPrice = parseOptionalMoney(row.discountPrice)
      if (basePrice === null && discountPrice === null) {
        throw new Error("Base Price or Discount Price is required")
      }

      const supplierPart = resolveSupplierPart(vendorSku)

      if (!supplierPart) {
        results.push({
          ok: false as const,
          rowNumber: row.rowNumber,
          vendorSku,
          reason: "No mapped product exists for this supplier SKU",
        })
        continue
      }

      const matchedVendorSku = normalizeVendorSku(supplierPart.vendorSku ?? vendorSku)
      const currency = normalizeOptionalText(row.currency)?.toUpperCase() ?? DEFAULT_CURRENCY
      const effectivePrice = discountPrice ?? basePrice
      await db.supplierPartPricing.upsert({
        where: {
          supplierId_vendorSku: {
            supplierId,
            vendorSku: matchedVendorSku,
          },
        },
        create: {
          supplierId,
          supplierPartId: supplierPart.id,
          vendorSku: matchedVendorSku,
          basePrice,
          discountPrice,
          currency,
          taxClass: normalizeOptionalText(row.taxClass),
          vat: normalizeOptionalText(row.vat),
          maxRetailPrice: parseOptionalMoney(row.maxRetailPrice),
          wholesaleDistributorPrice: parseOptionalMoney(
            row.wholesaleDistributorPrice,
          ),
          fleetPrice: parseOptionalMoney(row.fleetPrice),
          rawUploadData: parseJson(row.rawUploadData),
        },
        update: {
          supplierPartId: supplierPart.id,
          basePrice,
          discountPrice,
          currency,
          taxClass: normalizeOptionalText(row.taxClass),
          vat: normalizeOptionalText(row.vat),
          maxRetailPrice: parseOptionalMoney(row.maxRetailPrice),
          wholesaleDistributorPrice: parseOptionalMoney(
            row.wholesaleDistributorPrice,
          ),
          fleetPrice: parseOptionalMoney(row.fleetPrice),
          rawUploadData: parseJson(row.rawUploadData),
        },
      })

      await db.supplierPart.update({
        where: { id: supplierPart.id },
        data: {
          price: effectivePrice ?? 0,
          currency,
        },
      })

      results.push({
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku: matchedVendorSku,
        part: await getSupplierPartById(supplierPart.id),
      })
    } catch (error) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason:
          error instanceof Error ? error.message : "Unable to update pricing",
      })
    }
  }

  return {
    totalRows: rows.length,
    updatedCount: results.filter((result) => result.ok).length,
    unmatchedCount: results.filter((result) => !result.ok).length,
    updatedParts: results
      .filter((result) => result.ok)
      .map((result) => result.part),
    unmatched: results.filter((result) => !result.ok),
  }
}

const splitProductMasterValues = (values: string[] | undefined) =>
  Array.from(new Set((values ?? []).map(normalizeText).filter(Boolean)))

const validateHttpUrl = (value: string | null, label: string) => {
  if (!value) return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`)
  }
}

export async function saveSupplierProductMaster(
  supplierId: string,
  input: SupplierProductMasterInput,
  supplierPartId?: string,
) {
  const sku = normalizeVendorSku(input.identity?.sku)
  const productName = normalizeRequiredProductText(
    input.identity?.productName,
    "Product name",
  )
  const categoryName = normalizeRequiredProductText(
    input.category?.name,
    "Category name",
  )
  const brandName = normalizeRequiredProductText(input.brand?.name, "Brand name")
  const mpn = normalizeOptionalText(input.identity?.mpn)
  const oemNumber = normalizeOptionalText(input.crossReferences?.oemNumber)
  const competitorPartNumber = normalizeOptionalText(
    input.crossReferences?.competitorPartNumber,
  )
  const competitorBrandName = normalizeOptionalText(
    input.crossReferences?.competitorBrandName,
  )
  const warehouseId = normalizeRequiredProductText(
    input.inventory?.warehouseId,
    "Warehouse ID",
  )
  if (!sku) throw new Error("SKU is required")
  if (!oemNumber && !mpn && !competitorPartNumber) {
    throw new Error("Provide an OEM number, MPN, or competitor part number")
  }
  if (!oemNumber && competitorPartNumber && !competitorBrandName) {
    throw new Error("Competitor brand name is required")
  }

  const basePrice = parseOptionalMoney(input.pricing?.basePrice)
  const discountPrice = parseOptionalMoney(input.pricing?.discountPrice)
  if (basePrice === null && discountPrice === null) {
    throw new Error("Base price or discount price is required")
  }
  const quantity = parseStock(input.inventory.quantity)
  const lowStockThreshold = parseOptionalNonNegativeWholeNumber(
    input.inventory.lowStockThreshold,
    "Low stock threshold",
  )
  const maxRetailPrice = parseOptionalMoney(input.pricing.maxRetailPrice)
  const wholesaleDistributorPrice = parseOptionalMoney(
    input.pricing.wholesaleDistributorPrice,
  )
  const fleetPrice = parseOptionalMoney(input.pricing.fleetPrice)
  const currency =
    normalizeOptionalText(input.pricing.currency)?.toUpperCase() ?? DEFAULT_CURRENCY

  const existing = supplierPartId
    ? await db.supplierPart.findFirst({
        where: { id: supplierPartId, supplierId },
      })
    : null
  if (supplierPartId && !existing) throw new Error("Supplier product not found")
  const skuOwner = await db.supplierPart.findUnique({
    where: { supplierId_vendorSku: { supplierId, vendorSku: sku } },
  })
  if (!supplierPartId && skuOwner) {
    throw new Error("This SKU already exists. Use Edit product instead")
  }
  if (skuOwner && skuOwner.id !== supplierPartId) {
    throw new Error("This SKU is already used by another supplier product")
  }

  const productCategories = splitProductMasterValues(
    input.brand.productCategories?.length
      ? input.brand.productCategories
      : [categoryName],
  )
  await syncCatalogLookups({
    categories: input.category.id
      ? [{
          id: normalizeText(input.category.id),
          name: categoryName,
          parentId: normalizeOptionalText(input.category.parentId),
        }]
      : [],
    brands: input.brand.id
      ? [{
          id: normalizeText(input.brand.id),
          brandName,
          categoryNames: productCategories,
          tierLabel: normalizeOptionalText(input.brand.tier),
        }]
      : [],
    vehicles:
      input.vehicle?.id && input.vehicle.make && input.vehicle.model
        ? [{
            id: normalizeText(input.vehicle.id),
            make: normalizeText(input.vehicle.make),
            model: normalizeText(input.vehicle.model),
            tierLabel: normalizeOptionalText(input.brand.tier),
          }]
        : [],
    grades: input.identity.grade
      ? [{ customerFacingLabel: normalizeText(input.identity.grade), description: null }]
      : [],
  })

  const resolutionRow: SupplierBulkProductRow = {
    rowNumber: 1,
    vendorSku: sku,
    oemNumber: oemNumber ?? "",
    mpn,
    brand: brandName,
    competitorPartNumber,
    competitorBrandName,
  }
  let resolution: BulkPartResolution | null = null
  let mappingError: string | null = null
  try {
    if (oemNumber) {
      resolution = await resolveConfirmedBulkPart(resolutionRow)
    } else if (competitorPartNumber) {
      resolution = await resolvePartFromCompetitor(resolutionRow)
    } else if (mpn) {
      resolution = await resolveConfirmedBulkPart({
        ...resolutionRow,
        oemNumber: mpn,
      })
    }
  } catch (error) {
    mappingError =
      error instanceof Error ? error.message : "Unable to confirm this product"
  }

  const resolvedOemNumber = oemNumber
    ? resolution?.resolvedOemNumber ?? oemNumber
    : competitorPartNumber
      ? resolution?.resolvedOemNumber ?? null
      : null
  const normalizedOemNumber = resolvedOemNumber
    ? normalizePartNumber(resolvedOemNumber)
    : null
  const normalizedMpn = mpn ? normalizePartNumber(mpn) : null
  if (normalizedOemNumber) {
    const duplicateOem = await findSupplierPartBySupplierOem(
      supplierId,
      normalizedOemNumber,
      supplierPartId,
    )
    if (duplicateOem) {
      throw new Error(
        `This OEM is already used under SKU ${duplicateOem.vendorSku ?? "unknown"}`,
      )
    }
  }
  if (normalizedMpn) {
    const duplicateMpn = await db.supplierPart.findFirst({
      where: {
        supplierId,
        normalizedMpn,
        ...(supplierPartId ? { id: { not: supplierPartId } } : {}),
      },
      select: { vendorSku: true },
    })
    if (duplicateMpn) {
      throw new Error(
        `This MPN is already used under SKU ${duplicateMpn.vendorSku ?? "unknown"}`,
      )
    }
  }

  const enteredImageUrls = splitProductMasterValues([
    normalizeOptionalText(input.images?.primaryUrl) ?? "",
    ...(input.images?.galleryUrls ?? []),
  ])
  enteredImageUrls.forEach((url, index) =>
    validateHttpUrl(url, index === 0 ? "Primary image URL" : `Gallery image ${index}`),
  )
  const documentUrl = normalizeOptionalText(input.document?.url)
  validateHttpUrl(documentUrl, "Document URL")
  const storedImageUrls = splitProductMasterValues(input.images?.storedUrls)
  const currentRaw =
    existing?.rawUploadData &&
    typeof existing.rawUploadData === "object" &&
    !Array.isArray(existing.rawUploadData)
      ? (existing.rawUploadData as Record<string, unknown>)
      : {}
  const previousEnteredImages = splitProductMasterValues([
    normalizeOptionalText(currentRaw["Product Images | Primary Image URL"]) ?? "",
    ...String(currentRaw["Product Images | Gallery Image URLs"] ?? "")
      .split(/[,;|\n]+/),
  ])
  const imageUrlsUnchanged =
    enteredImageUrls.join("|") === previousEnteredImages.join("|")
  const uploadedImageUrls =
    enteredImageUrls.length && !imageUrlsUnchanged
      ? await uploadSupplierImageUrlsToS3({
          supplierId,
          vendorSku: sku,
          imageUrls: enteredImageUrls,
        })
      : []
  const supplierImageUrls = uploadedImageUrls.length
    ? uploadedImageUrls
    : storedImageUrls.length
      ? storedImageUrls
      : existing?.supplierImageUrls ?? []

  const mappingStatus = resolution
    ? SupplierPartMappingStatus.mapped
    : SupplierPartMappingStatus.pending_review
  const master = resolution
    ? await db.partMaster.findUnique({ where: { partUid: resolution.partUid } })
    : null
  const rawUploadData: Record<string, unknown> = {
    SKU: sku,
    "Product Name": productName,
    "Short Description": normalizeOptionalText(input.identity.shortDescription) ?? "",
    "Long Description": normalizeOptionalText(input.identity.longDescription) ?? "",
    "Manufacturer Part Number (MPN)": mpn ?? "",
    Status: normalizeOptionalText(input.identity.status) ?? "",
    Grade: normalizeOptionalText(input.identity.grade) ?? "",
    Condition: normalizeOptionalText(input.identity.condition) ?? "",
    "Category ID": normalizeOptionalText(input.category.id) ?? "",
    "Category Name": categoryName,
    "Parent Category": normalizeOptionalText(input.category.parentId) ?? "",
    "Brand ID": normalizeOptionalText(input.brand.id) ?? "",
    "Brand Name": brandName,
    "Product Categories": productCategories.join(", "),
    "Tier 1": normalizeOptionalText(input.brand.tier) ?? "",
    "Attribute Name": normalizeOptionalText(input.attributes?.name) ?? "",
    "Attribute Value": normalizeOptionalText(input.attributes?.value) ?? "",
    "Detailed Attributes": normalizeOptionalText(input.attributes?.detailed) ?? "",
    "Attribute Name (B)": normalizeOptionalText(input.attributes?.nameB) ?? "",
    "Attribute Name (C)": normalizeOptionalText(input.attributes?.nameC) ?? "",
    "Vehicle ID": normalizeOptionalText(input.vehicle?.id) ?? "",
    "Vehicle Fitment | Make": normalizeOptionalText(input.vehicle?.make) ?? "",
    "Vehicle Fitment | Model": normalizeOptionalText(input.vehicle?.model) ?? "",
    "Vehicle Fitment | Year_Start": input.vehicle?.yearStart ?? "",
    "Vehicle Fitment | Year_End": input.vehicle?.yearEnd ?? "",
    "Vehicle Fitment | Engine": normalizeOptionalText(input.vehicle?.engine) ?? "",
    "Vehicle Fitment | Trim": normalizeOptionalText(input.vehicle?.trim) ?? "",
    "Vehicle Fitment | Drive_Type": normalizeOptionalText(input.vehicle?.driveType) ?? "",
    "Vehicle Fitment | Fitment Notes": normalizeOptionalText(input.vehicle?.notes) ?? "",
    "Product Pricing | Base Price (AED)": input.pricing.basePrice ?? "",
    "Product Pricing | Discount Price (AED)": input.pricing.discountPrice ?? "",
    "Product Pricing | Currency": currency,
    "Product Pricing | Tax Class": normalizeOptionalText(input.pricing.taxClass) ?? "",
    "Product Pricing | VAT": normalizeOptionalText(input.pricing.vat) ?? "",
    "Product Pricing | Max Retail Price": input.pricing.maxRetailPrice ?? "",
    "Product Pricing | Wholesale/Distributor Pricing": input.pricing.wholesaleDistributorPrice ?? "",
    "Product Pricing | Fleet Pricing": input.pricing.fleetPrice ?? "",
    "Product Inventory | Warehouse ID": warehouseId,
    "Product Inventory | Quantity": quantity,
    "Product Inventory | Lead Time": normalizeOptionalText(input.inventory.leadTime) ?? "",
    "Product Inventory | Low Stock Threshold": input.inventory.lowStockThreshold ?? "",
    "Product Images | Primary Image URL": normalizeOptionalText(input.images?.primaryUrl) ?? "",
    "Product Images | Gallery Image URLs": splitProductMasterValues(input.images?.galleryUrls).join(", "),
    "Product Documents | Document Type": normalizeOptionalText(input.document?.type) ?? "",
    "Product Documents | Document URL": documentUrl ?? "",
    "Cross References | Platform Part number (SKU)": master?.partNumber ?? "",
    "Cross References | OEM Part Number": oemNumber ?? "",
    "Cross References | OEM Supersession Numbers": splitProductMasterValues(input.crossReferences.oemSupersessionNumbers).join(", "),
    "Cross References | Competitor Part Number": competitorPartNumber ?? "",
    "Cross References | Competitor Brand Name": competitorBrandName ?? "",
    "Cross References | HS Code": normalizeOptionalText(input.crossReferences.hsCode) ?? "",
    "Product Bundles | Component SKU": normalizeOptionalText(input.bundle?.componentSku) ?? "",
    "Product Bundles | Quantity in Bundle": input.bundle?.quantityInBundle ?? "",
    "Product Bundles | Parent Bundle SKU": normalizeOptionalText(input.bundle?.parentBundleSku) ?? "",
    "Product Bundles | Quantity as Component": input.bundle?.quantityAsComponent ?? "",
    "Shipping Logistics | Weight (kg)": input.shipping?.weightKg ?? "",
    "Shipping Logistics | Length (cm)": input.shipping?.lengthCm ?? "",
    "Shipping Logistics | Width (cm)": input.shipping?.widthCm ?? "",
    "Shipping Logistics | Height (cm)": input.shipping?.heightCm ?? "",
    "Shipping Logistics | HS Code": normalizeOptionalText(input.shipping?.hsCode) ?? "",
    "Shipping Logistics | Country of Origin": normalizeOptionalText(input.shipping?.countryOfOrigin) ?? "",
    "Compliance | Warranty Period (Months)": input.compliance?.warrantyMonths ?? "",
    "Compliance | Certification (e.g., ESMA)": normalizeOptionalText(input.compliance?.certification) ?? "",
    "Marketplace Settings | Allow Backorders (Yes/No)": input.marketplace?.allowBackorders ? "Yes" : "No",
    "Marketplace Settings | Max Order Quantity": input.marketplace?.maxOrderQuantity ?? "",
    "Marketplace Settings | Is Active (Yes/No)": input.marketplace?.isActive === false ? "No" : "Yes",
    "Upload Validation | Validation Status": resolution ? "Mapped" : "Pending Review",
    "Upload Validation | Missing Fields": resolution ? "" : mappingError ?? "Product mapping",
  }

  const partData = {
    vendorSku: sku,
    partUid: resolution?.partUid ?? null,
    originalPartName: productName,
    originalBrand: brandName,
    originalMpn: mpn,
    originalOemNumber: resolvedOemNumber,
    normalizedMpn,
    normalizedOemNumber,
    price: discountPrice ?? basePrice ?? 0,
    stock: quantity,
    currency,
    category: categoryName,
    oemSupersessionNumbers: splitProductMasterValues(
      input.crossReferences.oemSupersessionNumbers,
    ),
    competitorPartNumber,
    competitorBrandName,
    hsCode: normalizeOptionalText(input.crossReferences.hsCode),
    supplierImageUrls,
    mappingStatus,
    mappingSource: resolution?.mappingSource ?? null,
    mappingError: resolution ? null : mappingError ?? "Product was not confirmed in the local catalog or 17VIN",
    rawUploadData: parseJson(rawUploadData),
  }

  const savedId = await db.$transaction(async (tx) => {
    const supplierPart = existing
      ? await tx.supplierPart.update({ where: { id: existing.id }, data: partData })
      : await tx.supplierPart.create({ data: { supplierId, ...partData } })
    await tx.supplierPartPricing.upsert({
      where: { supplierPartId: supplierPart.id },
      create: {
        supplierId,
        supplierPartId: supplierPart.id,
        vendorSku: sku,
        basePrice,
        discountPrice,
        currency,
        taxClass: normalizeOptionalText(input.pricing.taxClass),
        vat: normalizeOptionalText(input.pricing.vat),
        maxRetailPrice,
        wholesaleDistributorPrice,
        fleetPrice,
        rawUploadData: parseJson(rawUploadData),
      },
      update: {
        vendorSku: sku,
        basePrice,
        discountPrice,
        currency,
        taxClass: normalizeOptionalText(input.pricing.taxClass),
        vat: normalizeOptionalText(input.pricing.vat),
        maxRetailPrice,
        wholesaleDistributorPrice,
        fleetPrice,
        rawUploadData: parseJson(rawUploadData),
      },
    })
    await tx.supplierPartStock.deleteMany({
      where: { supplierPartId: supplierPart.id },
    })
    await tx.supplierPartStock.create({
      data: {
        supplierId,
        supplierPartId: supplierPart.id,
        vendorSku: sku,
        warehouseId,
        quantity,
        leadTime: normalizeOptionalText(input.inventory.leadTime),
        lowStockThreshold,
        rawUploadData: parseJson(rawUploadData),
      },
    })
    return supplierPart.id
  })

  return getSupplierPartById(savedId)
}

export async function updateSupplierPartOffer(
  supplierId: string,
  supplierPartId: string,
  input: SupplierOfferUpdateInput,
) {
  const supplierPart = await db.supplierPart.findFirst({
    where: { id: supplierPartId, supplierId },
    select: { id: true, vendorSku: true, rawUploadData: true },
  })

  if (!supplierPart) {
    throw new Error("Supplier part not found")
  }

  const vendorSku =
    input.vendorSku === undefined || input.vendorSku === null
      ? null
      : normalizeVendorSku(input.vendorSku)
  if (input.vendorSku !== undefined && !vendorSku) {
    throw new Error("SKU is required")
  }
  if (vendorSku && vendorSku !== supplierPart.vendorSku) {
    const existingSku = await db.supplierPart.findUnique({
      where: {
        supplierId_vendorSku: {
          supplierId,
          vendorSku,
        },
      },
      select: { id: true },
    })
    if (existingSku && existingSku.id !== supplierPart.id) {
      throw new Error("This SKU is already used by another supplier product")
    }
  }

  const productName = normalizeOptionalText(input.productName)
  const mpn = normalizeOptionalText(input.mpn)
  const grade = normalizeOptionalText(input.grade)
  const condition = normalizeOptionalText(input.condition)
  const currentRawData =
    supplierPart.rawUploadData &&
    typeof supplierPart.rawUploadData === "object" &&
    !Array.isArray(supplierPart.rawUploadData)
      ? { ...(supplierPart.rawUploadData as Record<string, unknown>) }
      : {}
  const submittedRawData =
    input.rawUploadData &&
    typeof input.rawUploadData === "object" &&
    !Array.isArray(input.rawUploadData)
      ? (input.rawUploadData as Record<string, unknown>)
      : {}
  const rawUploadData = { ...currentRawData, ...submittedRawData }
  const finalVendorSku = vendorSku ?? supplierPart.vendorSku ?? ""

  rawUploadData.SKU = finalVendorSku
  if (productName) {
    rawUploadData["Product Name"] = productName
  }
  if (input.shortDescription !== undefined) {
    rawUploadData["Short Description"] =
      normalizeOptionalText(input.shortDescription) ?? ""
  }
  if (input.longDescription !== undefined) {
    rawUploadData["Long Description"] =
      normalizeOptionalText(input.longDescription) ?? ""
  }
  if (mpn) {
    rawUploadData["Manufacturer Part Number (MPN)"] = mpn
  }
  if (input.status !== undefined) {
    rawUploadData.Status = normalizeOptionalText(input.status) ?? ""
  }
  if (input.grade !== undefined) {
    rawUploadData.Grade = grade ?? ""
  }
  if (input.condition !== undefined) {
    rawUploadData.Condition = condition ?? ""
  }
  const basePrice = parseOptionalMoney(input.basePrice)
  const discountPrice = parseOptionalMoney(input.discountPrice)
  const currency =
    normalizeOptionalText(input.currency)?.toUpperCase() ?? DEFAULT_CURRENCY
  const maxRetailPrice = parseOptionalMoney(input.maxRetailPrice)
  const wholesaleDistributorPrice = parseOptionalMoney(
    input.wholesaleDistributorPrice,
  )
  const fleetPrice = parseOptionalMoney(input.fleetPrice)
  const activePrice = discountPrice ?? basePrice ?? parseMoney(input.price)

  rawUploadData["Base Price (AED)"] = input.basePrice ?? ""
  rawUploadData["Discount Price (AED)"] = input.discountPrice ?? ""
  rawUploadData.Currency = currency
  rawUploadData["Tax Class"] = normalizeOptionalText(input.taxClass) ?? ""
  rawUploadData.VAT = normalizeOptionalText(input.vat) ?? ""
  rawUploadData["Max Retail Price"] = input.maxRetailPrice ?? ""
  rawUploadData["Wholesale/Distributor Pricing"] =
    input.wholesaleDistributorPrice ?? ""
  rawUploadData["Fleet Pricing"] = input.fleetPrice ?? ""
  rawUploadData.Price = input.price
  rawUploadData.Stock = input.stock

  await db.$transaction([
    db.supplierPart.update({
      where: { id: supplierPart.id },
      data: {
        ...(vendorSku ? { vendorSku } : {}),
        ...(productName ? { originalPartName: productName } : {}),
        ...(mpn
          ? {
              originalMpn: mpn,
              normalizedMpn: normalizePartNumber(mpn),
            }
          : {}),
        ...(grade || condition ? { category: grade ?? condition } : {}),
        price: activePrice,
        stock: parseStock(input.stock),
        currency,
        rawUploadData: parseJson(rawUploadData),
      },
    }),
    db.supplierPartPricing.upsert({
      where: { supplierPartId: supplierPart.id },
      create: {
        supplierId,
        supplierPartId: supplierPart.id,
        vendorSku: finalVendorSku,
        basePrice,
        discountPrice,
        currency,
        taxClass: normalizeOptionalText(input.taxClass),
        vat: normalizeOptionalText(input.vat),
        maxRetailPrice,
        wholesaleDistributorPrice,
        fleetPrice,
        rawUploadData: parseJson(rawUploadData),
      },
      update: {
        vendorSku: finalVendorSku,
        basePrice,
        discountPrice,
        currency,
        taxClass: normalizeOptionalText(input.taxClass),
        vat: normalizeOptionalText(input.vat),
        maxRetailPrice,
        wholesaleDistributorPrice,
        fleetPrice,
        rawUploadData: parseJson(rawUploadData),
      },
    }),
  ])

  return getSupplierPartById(supplierPart.id)
}

export async function runSupplierPartMapping(supplierPartId: string) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
  })

  if (!supplierPart) {
    throw new Error("Supplier part not found")
  }

  if (supplierPart.partUid) {
    const master = await db.partMaster.findUnique({
      where: { partUid: supplierPart.partUid },
      select: { source: true },
    })
    if (master?.source.endsWith("_pending")) {
      return db.supplierPart.update({
        where: { id: supplierPartId },
        data: {
          mappingStatus: SupplierPartMappingStatus.pending_review,
          mappingSource: null,
          mappingError: "First-vendor product details require admin approval",
        },
      })
    }
  }

  const normalizedMpn =
    supplierPart.normalizedMpn ??
    (supplierPart.originalMpn ? normalizePartNumber(supplierPart.originalMpn) : null)
  const normalizedOemNumber =
    supplierPart.normalizedOemNumber ??
    (supplierPart.originalOemNumber
      ? normalizePartNumber(supplierPart.originalOemNumber)
      : null)

  await db.supplierPart.update({
    where: { id: supplierPartId },
    data: {
      mappingStatus: SupplierPartMappingStatus.processing,
      mappingError: null,
      normalizedMpn,
      normalizedOemNumber,
    },
  })

  const localPartUid = await findLocalPartUid(
    normalizedOemNumber,
    normalizedMpn,
    supplierPart.originalBrand,
  )

  if (localPartUid) {
    return db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        partUid: localPartUid,
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource: SupplierPartMappingSource.local_db,
        mappingError: null,
      },
    })
  }

  try {
    const firstQuery =
      supplierPart.originalOemNumber ??
      supplierPart.originalMpn ??
      normalizedOemNumber ??
      normalizedMpn
    const fallbackQuery =
      supplierPart.originalOemNumber && supplierPart.originalMpn
        ? supplierPart.originalMpn
        : null

    const allCandidates = await search17VinCandidates([firstQuery, fallbackQuery])
    const { candidate, confident, matchError } = pick17VinCandidate(
      allCandidates,
      normalizedOemNumber,
      normalizedMpn,
      supplierPart.originalBrand,
    )

    if (!candidate || !confident) {
      return db.supplierPart.update({
        where: { id: supplierPartId },
        data: {
          mappingStatus: SupplierPartMappingStatus.pending_review,
          mappingError:
            matchError ??
            (candidate
              ? "Uncertain match needs admin review"
              : "No matching part found"),
        },
      })
    }

    const partUid = await findOrCreatePartMasterFrom17Vin(candidate, supplierPart)

    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: supplierPart.originalOemNumber,
      numberType: PartNumberType.oem,
      brand: supplierPart.originalBrand,
      source: "supplier_upload",
    })
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: supplierPart.originalMpn,
      numberType: PartNumberType.mpn,
      brand: supplierPart.originalBrand,
      source: "supplier_upload",
    })
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: candidate.partNumber,
      numberType: PartNumberType.brand_part_number,
      brand: candidate.brandName ?? supplierPart.originalBrand,
      source: "17vin",
    })

    if (candidate.partNumber && candidate.groupId) {
      const vehicles = await get17VinApplicableModels(
        candidate.partNumber,
        candidate.groupId,
      )
      await saveFitments(partUid, vehicles)
    }

    return db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        partUid,
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource: SupplierPartMappingSource.vin17,
        mappingError: null,
      },
    })
  } catch {
    return db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        mappingStatus: SupplierPartMappingStatus.failed,
        mappingError: "Unable to map this part automatically",
      },
    })
  }
}

export async function approveFirstVendorProduct(supplierPartId: string) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
    include: { part: true },
  })

  if (!supplierPart?.part || !supplierPart.partUid) {
    throw new Error("First-vendor product draft not found")
  }
  if (!supplierPart.part.source.endsWith("_pending")) {
    throw new Error("This product is not awaiting first-vendor approval")
  }
  if (
    supplierPart.part.imageUrls.length === 0 ||
    supplierPart.part.keyFeatures.length === 0 ||
    !supplierPart.part.badgeText ||
    !supplierPart.part.heading ||
    !supplierPart.part.description ||
    !supplierPart.originalBrand ||
    !supplierPart.originalMpn ||
    !supplierPart.originalOemNumber
  ) {
    throw new Error("Product images and complete catalog content are required")
  }

  await createPartNumberIndexIfMissing({
    partUid: supplierPart.partUid,
    numberOriginal: supplierPart.originalOemNumber,
    numberType: PartNumberType.oem,
    brand: supplierPart.originalBrand,
    source: "admin_approved_supplier",
  })
  await createPartNumberIndexIfMissing({
    partUid: supplierPart.partUid,
    numberOriginal: supplierPart.originalMpn,
    numberType: PartNumberType.mpn,
    brand: supplierPart.originalBrand,
    source: "admin_approved_supplier",
  })

  const mappingSource = supplierPart.part.source.startsWith("17vin")
    ? SupplierPartMappingSource.vin17
    : SupplierPartMappingSource.manual

  await db.$transaction([
    db.partMaster.update({
      where: { partUid: supplierPart.partUid },
      data: { source: supplierPart.part.source.replace(/_pending$/, "") },
    }),
    db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource,
        mappingError: null,
      },
    }),
  ])

  return getSupplierPartById(supplierPartId)
}

export async function updateSupplierPartContent(
  supplierPartId: string,
  input: PartContentUpdateInput,
) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
    include: { part: true },
  })

  if (!supplierPart?.part || !supplierPart.partUid) {
    throw new Error("Master product not found")
  }

  const partName = normalizeRequiredProductText(input.partName, "Product name")
  const category = normalizeRequiredProductText(input.category, "Category")
  const badgeText = normalizeRequiredProductText(input.badgeText, "Badge text")
  const heading = normalizeRequiredProductText(input.heading, "Heading")
  const description = normalizeRequiredProductText(input.description, "Description")
  const keyFeatures = Array.from(
    new Set(input.keyFeatures.map(normalizeText).filter(Boolean)),
  ).slice(0, 12)
  const imageUrls = Array.from(
    new Set(input.imageUrls.map(normalizeText).filter(Boolean)),
  ).slice(0, 8)
  const imageKeys = Array.from(
    new Set(input.imageKeys.map(normalizeText).filter(Boolean)),
  ).slice(0, 8)

  if (keyFeatures.length === 0) {
    throw new Error("At least one key feature is required")
  }
  if (
    imageUrls.length === 0 ||
    imageUrls.length !== imageKeys.length ||
    imageKeys.some(
      (key) =>
        !key.startsWith("supplier-products/") &&
        !key.startsWith("product-images/"),
    )
  ) {
    throw new Error("At least one uploaded product image is required")
  }

  const removedImageKeys = supplierPart.part.imageKeys.filter(
    (key) => !imageKeys.includes(key),
  )

  await db.$transaction([
    db.partMaster.update({
      where: { partUid: supplierPart.partUid },
      data: {
        partName,
        category,
        imageUrl: imageUrls[0],
        imageUrls,
        imageKeys,
        badgeText,
        heading,
        description,
        keyFeatures,
      },
    }),
    db.supplierPart.updateMany({
      where: { partUid: supplierPart.partUid },
      data: { originalPartName: partName, category },
    }),
  ])

  await Promise.allSettled(removedImageKeys.map(deleteObjectFromS3))

  return getSupplierPartById(supplierPartId)
}

export async function manuallyMapSupplierPart(
  supplierPartId: string,
  input: ManualMapInput,
) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
  })

  if (!supplierPart) {
    throw new Error("Supplier part not found")
  }

  const partUid = normalizeOptionalText(input.partUid)

  if (partUid) {
    const existing = await db.partMaster.findUnique({ where: { partUid } })
    if (!existing) {
      throw new Error("PartMaster not found")
    }
  } else {
    throw new Error(
      "New master products require the complete supplier product form with images and features",
    )
  }

  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: supplierPart.originalOemNumber,
    numberType: PartNumberType.oem,
    brand: supplierPart.originalBrand,
    source: "manual",
  })
  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: supplierPart.originalMpn,
    numberType: PartNumberType.mpn,
    brand: supplierPart.originalBrand,
    source: "manual",
  })

  for (const number of input.numbers ?? []) {
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: number.numberOriginal,
      numberType: number.numberType ?? PartNumberType.unknown,
      brand: number.brand,
      source: "manual",
    })
  }

  await db.supplierPart.update({
    where: { id: supplierPartId },
    data: {
      partUid,
      mappingStatus: SupplierPartMappingStatus.mapped,
      mappingSource: SupplierPartMappingSource.manual,
      mappingError: null,
    },
  })

  return getSupplierPartById(supplierPartId)
}

export async function getSupplierPartById(id: string) {
  const part = await db.supplierPart.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      part: {
        select: {
          partUid: true,
          partName: true,
          partNumber: true,
          brandName: true,
          category: true,
          source: true,
          imageUrls: true,
          imageKeys: true,
          badgeText: true,
          heading: true,
          description: true,
          keyFeatures: true,
        },
      },
      pricing: true,
    },
  })

  if (!part) {
    throw new Error("Supplier part not found")
  }

  return mapSupplierPart(part)
}

export async function deleteSupplierPart(id: string) {
  return db.$transaction(async (transaction) => {
    const part = await transaction.supplierPart.findUnique({
      where: { id },
      select: { id: true, partUid: true },
    })

    if (!part) {
      throw new Error("Supplier part not found")
    }

    await transaction.supplierPart.delete({ where: { id } })

    let deletedMasterPart = false
    if (part.partUid) {
      const remainingSupplierCount = await transaction.supplierPart.count({
        where: { partUid: part.partUid },
      })

      if (remainingSupplierCount === 0) {
        await transaction.partMaster.delete({ where: { partUid: part.partUid } })
        deletedMasterPart = true
      }
    }

    return { id, deletedMasterPart }
  })
}

export async function listSupplierParts(input: {
  supplierId?: string
  status?: SupplierPartMappingStatus
  query?: string
  limit?: number
}) {
  const query = normalizeText(input.query)
  const where: Prisma.SupplierPartWhereInput = {
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    ...(input.status ? { mappingStatus: input.status } : {}),
    ...(query
      ? {
          OR: [
            { originalPartName: { contains: query, mode: "insensitive" } },
            { vendorSku: { contains: query, mode: "insensitive" } },
            { originalBrand: { contains: query, mode: "insensitive" } },
            { originalMpn: { contains: query, mode: "insensitive" } },
            { originalOemNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const parts = await db.supplierPart.findMany({
    where,
    take: Math.min(input.limit ?? 100, 250),
    orderBy: [{ updatedAt: "desc" }],
    include: {
      supplier: {
        select: {
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      part: {
        select: {
          partUid: true,
          partName: true,
          partNumber: true,
          brandName: true,
          category: true,
          source: true,
          imageUrls: true,
          imageKeys: true,
          badgeText: true,
          heading: true,
          description: true,
          keyFeatures: true,
        },
      },
      pricing: true,
    },
  })

  return parts.map(mapSupplierPart)
}

const mappedSupplierPartWhere: Prisma.SupplierPartWhereInput = {
  mappingStatus: SupplierPartMappingStatus.mapped,
  partUid: { not: null },
}

const toUniqueTextList = (values: Array<string | null | undefined>) =>
  Array.from(
    new Map(
      values
        .map((value) => normalizeOptionalText(value))
        .filter((value): value is string => Boolean(value))
        .map((value) => [value.toUpperCase(), value] as const),
    ).values(),
  )

const mapMappedCatalogPart = (part: {
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
  updatedAt: Date
  numbers: Array<{
    numberOriginal: string
    numberType: PartNumberType
  }>
  supplierParts: Array<{
    originalOemNumber: string | null
    originalMpn: string | null
    updatedAt: Date
  }>
}): MappedCatalogPartRecord => {
  const indexedOems = part.numbers
    .filter((number) => number.numberType === PartNumberType.oem)
    .map((number) => number.numberOriginal)
  const indexedMpns = part.numbers
    .filter((number) => number.numberType === PartNumberType.mpn)
    .map((number) => number.numberOriginal)
  const supplierOems = part.supplierParts.map((supplierPart) =>
    supplierPart.originalOemNumber,
  )
  const supplierMpns = part.supplierParts.map((supplierPart) =>
    supplierPart.originalMpn,
  )
  const latestSupplierPartUpdatedAt = part.supplierParts.reduce<Date | null>(
    (latest, supplierPart) =>
      !latest || supplierPart.updatedAt > latest ? supplierPart.updatedAt : latest,
    null,
  )

  return {
    partUid: part.partUid,
    partName: part.partName,
    partNumber: part.partNumber,
    brandName: part.brandName,
    category: part.category,
    source: part.source,
    imageUrls: part.imageUrls,
    imageKeys: part.imageKeys,
    badgeText: part.badgeText,
    heading: part.heading,
    description: part.description,
    keyFeatures: part.keyFeatures,
    oemNumbers: toUniqueTextList([...indexedOems, ...supplierOems]),
    mpnNumbers: toUniqueTextList([...indexedMpns, ...supplierMpns]),
    mappedStatus: SupplierPartMappingStatus.mapped,
    supplierPartCount: part.supplierParts.length,
    latestSupplierPartUpdatedAt:
      latestSupplierPartUpdatedAt?.toISOString() ?? part.updatedAt.toISOString(),
  }
}

export async function listMappedCatalogPartsPage(input: {
  query?: string
  page?: number
  pageSize?: number
}) {
  const query = normalizeText(input.query)
  const normalizedQuery = query ? normalizePartNumber(query) : ""
  const page = Math.max(1, Number.isFinite(input.page) ? input.page ?? 1 : 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number.isFinite(input.pageSize) ? input.pageSize ?? 10 : 10),
  )
  const numberSearch: Prisma.PartNumberIndexWhereInput[] = query
    ? [
        { numberOriginal: { contains: query, mode: "insensitive" } },
        ...(normalizedQuery
          ? [{ numberNormalized: { contains: normalizedQuery } }]
          : []),
      ]
    : []
  const supplierNumberSearch: Prisma.SupplierPartWhereInput[] = query
    ? [
        { originalOemNumber: { contains: query, mode: "insensitive" } },
        { originalMpn: { contains: query, mode: "insensitive" } },
        ...(normalizedQuery
          ? [
              { normalizedOemNumber: { contains: normalizedQuery } },
              { normalizedMpn: { contains: normalizedQuery } },
            ]
          : []),
      ]
    : []
  const where: Prisma.PartMasterWhereInput = {
    supplierParts: { some: mappedSupplierPartWhere },
    ...(query
      ? {
          OR: [
            { partUid: { contains: query, mode: "insensitive" } },
            { partName: { contains: query, mode: "insensitive" } },
            { heading: { contains: query, mode: "insensitive" } },
            { partNumber: { contains: query, mode: "insensitive" } },
            { partNumberOriginal: { contains: query, mode: "insensitive" } },
            { brandName: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            ...(numberSearch.length
              ? [{ numbers: { some: { OR: numberSearch } } }]
              : []),
            ...(supplierNumberSearch.length
              ? [
                  {
                    supplierParts: {
                      some: {
                        ...mappedSupplierPartWhere,
                        OR: supplierNumberSearch,
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  }

  const [parts, total] = await Promise.all([
    db.partMaster.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        numbers: {
          where: { numberType: { in: [PartNumberType.oem, PartNumberType.mpn] } },
          orderBy: [{ numberType: "asc" }, { createdAt: "asc" }],
          select: { numberOriginal: true, numberType: true },
        },
        supplierParts: {
          where: mappedSupplierPartWhere,
          orderBy: [{ updatedAt: "desc" }],
          select: {
            originalOemNumber: true,
            originalMpn: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.partMaster.count({ where }),
  ])

  return {
    parts: parts.map(mapMappedCatalogPart),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function listSupplierPartsPage(input: {
  supplierId?: string
  status?: SupplierPartMappingStatus
  query?: string
  page?: number
  pageSize?: number
}) {
  const query = normalizeText(input.query)
  const page = Math.max(1, Number.isFinite(input.page) ? input.page ?? 1 : 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number.isFinite(input.pageSize) ? input.pageSize ?? 10 : 10),
  )
  const where: Prisma.SupplierPartWhereInput = {
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    ...(input.status ? { mappingStatus: input.status } : {}),
    ...(query
      ? {
          OR: [
            { originalPartName: { contains: query, mode: "insensitive" } },
            { vendorSku: { contains: query, mode: "insensitive" } },
            { originalBrand: { contains: query, mode: "insensitive" } },
            { originalMpn: { contains: query, mode: "insensitive" } },
            { originalOemNumber: { contains: query, mode: "insensitive" } },
            { partUid: { contains: query, mode: "insensitive" } },
            {
              supplier: {
                is: {
                  OR: [
                    { companyName: { contains: query, mode: "insensitive" } },
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const [parts, total] = await Promise.all([
    db.supplierPart.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        supplier: {
          select: {
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        part: {
          select: {
            partUid: true,
            partName: true,
            partNumber: true,
            brandName: true,
            category: true,
            source: true,
            imageUrls: true,
            imageKeys: true,
            badgeText: true,
            heading: true,
            description: true,
            keyFeatures: true,
          },
        },
        pricing: true,
      },
    }),
    db.supplierPart.count({ where }),
  ])

  return {
    parts: parts.map(mapSupplierPart),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function searchPartsFromLocalDb(input: {
  partNumber: string
  userId?: string | null
}): Promise<PartSearchResponse> {
  const searchedNumber = normalizeText(input.partNumber)
  const normalizedNumber = normalizePartNumber(searchedNumber)

  if (!normalizedNumber) {
    throw new Error("partNumber is required")
  }

  const index = await db.partNumberIndex.findFirst({
    where: { numberNormalized: normalizedNumber },
    select: { partUid: true },
  })

  if (!index) {
    await db.unmatchedPartSearchLog.create({
      data: {
        searchedNumber,
        normalizedNumber,
        userId: input.userId ?? null,
        resultStatus: "not_found",
      },
    })

    return { ok: true, found: false, result: null }
  }

  const part = await db.partMaster.findUnique({
    where: { partUid: index.partUid },
    include: {
      supplierParts: {
        where: {
          mappingStatus: SupplierPartMappingStatus.mapped,
          stock: { gt: 0 },
        },
        include: {
          supplier: {
            select: {
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          part: {
            select: {
              partUid: true,
              partName: true,
              partNumber: true,
              brandName: true,
              category: true,
              source: true,
              imageUrls: true,
              imageKeys: true,
              badgeText: true,
              heading: true,
              description: true,
              keyFeatures: true,
            },
          },
        },
      },
      fitments: {
        orderBy: [{ make: "asc" }, { model: "asc" }, { modelYear: "desc" }],
        take: 200,
      },
    },
  })

  if (!part) {
    return { ok: true, found: false, result: null }
  }

  return {
    ok: true,
    found: true,
    result: {
      part: {
        partUid: part.partUid,
        partName: part.partName,
        partNumber: part.partNumber,
        brandName: part.brandName,
        category: part.category,
        source: part.source,
        imageUrls: part.imageUrls,
        imageKeys: part.imageKeys,
        badgeText: part.badgeText,
        heading: part.heading,
        description: part.description,
        keyFeatures: part.keyFeatures,
      },
      supplierParts: part.supplierParts.map(mapSupplierPart),
      fitments: part.fitments.map((fitment) => ({
        brand: fitment.brand,
        make: fitment.make,
        model: fitment.model,
        series: fitment.series,
        modelYear: fitment.modelYear,
        yearFrom: fitment.yearFrom,
        yearTo: fitment.yearTo,
        engine: fitment.engine,
        engineNo: fitment.engineNo,
      })),
    },
  }
}

export const isSupplierUser = (user: { activeRole: UserRole; roles: UserRole[] }) =>
  user.activeRole === UserRole.Supplier || user.roles.includes(UserRole.Supplier)
