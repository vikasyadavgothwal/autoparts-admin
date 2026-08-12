import { Buffer } from "node:buffer"
import crypto from "node:crypto"

import { db } from "@/lib/database/prisma"
import { uploadObjectToS3 } from "@/lib/storage/s3"
import {
  get17VinApplicableModels,
  get17VinInterchanges,
  normalizePartNumber,
  searchPartIn17Vin,
  type Vin17PartCandidate,
  type Vin17VehicleCandidate,
} from "@/lib/vin-17-api-client"
import {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
  type Prisma,
} from "@/lib/generated/prisma/client"
import type {
  MappedCatalogPartRecord,
  SupplierBulkProductRow,
  SupplierPartLookupInput,
} from "@/types/parts-mapping/parts-mapping"

export const DEFAULT_CURRENCY = "AED"
export const SUPPLIER_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const SUPPLIER_IMAGE_FETCH_TIMEOUT_MS = 15_000
export const SUPPLIER_IMAGE_UPLOAD_CONCURRENCY = 3
const SUPPORTED_SUPPLIER_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

export const normalizeOptionalText = (value: unknown): string | null => {
  const normalized = normalizeText(value)
  return normalized || null
}

export const normalizeVendorSku = (value: unknown): string =>
  normalizeText(value).toUpperCase()

export const normalizeVendorSkuLookupKey = (value: unknown): string =>
  normalizeVendorSku(value).replace(/[^A-Z0-9]/g, "")

export type SupplierSkuCandidate = {
  id: string
  vendorSku: string | null
}

export const createSupplierPartSkuResolver = async (supplierId: string) => {
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

export type SupplierOemCandidate = {
  id: string
  vendorSku: string | null
  partUid: string | null
}

export const findSupplierPartBySupplierOem = async (
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

export const normalizeBrandToken = (value: string): string => {
  const token = value.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return BRAND_ALIASES[token] ?? token
}

export const brandsAreCompatible = (
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

export const parseMoney = (value: number | string): number => {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Price must be a non-negative number")
  }

  return Math.round(numeric * 100)
}

export const parseStock = (value: number | string): number => {
  const numeric = typeof value === "number" ? value : Number.parseInt(value, 10)
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error("Stock must be a non-negative whole number")
  }

  return numeric
}

export const parseOptionalMoney = (
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

export const parseNonNegativeWholeNumber = (
  value: number | string | null | undefined,
  label: string,
): number => {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative whole number`)
  }

  return numeric
}

export const parseOptionalNonNegativeWholeNumber = (
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

export const parseJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export const makePartUid = () => `part_${crypto.randomUUID().replace(/-/g, "")}`

export const mapSupplierPart = (part: {
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
  isActive: boolean
  planSuspendedAt: Date | null
  planSuspensionReason: string | null
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
  isActive: part.isActive,
  planSuspendedAt: part.planSuspendedAt?.toISOString() ?? null,
  planSuspensionReason: part.planSuspensionReason,
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

export const normalizeInputNumbers = (input: {
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

export const findLocalPartUid = async (
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

export const findConfirmedLocalPartUid = async (
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

export const createPartNumberIndexIfMissing = async (input: {
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

export const search17VinCandidates = async (
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

export const pick17VinCandidate = (
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

export const findOrCreatePartMasterFrom17Vin = async (
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

export const saveFitments = async (
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

export const validateLookupInput = (input: SupplierPartLookupInput) => {
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

export const partMasterSummary = (part: {
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


export const normalizeRequiredProductText = (value: unknown, label: string) => {
  const normalized = normalizeOptionalText(value)
  if (!normalized) {
    throw new Error(`${label} is required`)
  }
  return normalized
}


export type BulkPartResolution = {
  partUid: string
  mappingSource: SupplierPartMappingSource
  resolvedOemNumber: string
  resolvedBrand: string | null
}

export const resolveConfirmedBulkPart = async (
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

export const findLocalEquivalentOem = async (
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

export const resolvePartFromCompetitor = async (
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

export const mapWithConcurrency = async <T, R>(
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

export class SupplierImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupplierImageUploadError"
  }
}

export const normalizeImageContentType = (value: string | null): string =>
  value?.split(";")[0]?.trim().toLowerCase() ?? ""

export const sanitizeS3PathSegment = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return sanitized.slice(0, 80) || "sku"
}

export const isBlockedExternalImageHost = (hostname: string): boolean => {
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

export const fetchExternalSupplierImage = async (
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

export const uploadSupplierImageUrlsToS3 = async ({
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

export const withUploadedSupplierImageUrls = async (
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

export const hasSupplierProductInfo = (row: SupplierBulkProductRow) =>
  Boolean(
    normalizeOptionalText(row.productName) &&
      normalizeOptionalText(row.mpn ?? row.oemNumber),
  )

export const hasUploadedValue = (value: unknown) =>
  !(value === null || value === undefined || (typeof value === "string" && value.trim() === ""))

export const isSupplierOemConflictError = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.message.startsWith("This OEM is already used") ||
    error.message.startsWith("This supplier OEM is already mapped"))

export const upsertPendingSupplierProductInfo = async (
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


export const splitProductMasterValues = (values: string[] | undefined) =>
  Array.from(new Set((values ?? []).map(normalizeText).filter(Boolean)))

export const validateHttpUrl = (value: string | null, label: string) => {
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


export const toUniqueTextList = (values: Array<string | null | undefined>) =>
  Array.from(
    new Map(
      values
        .map((value) => normalizeOptionalText(value))
        .filter((value): value is string => Boolean(value))
        .map((value) => [value.toUpperCase(), value] as const),
    ).values(),
  )

export const mapMappedCatalogPart = (part: {
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
