import crypto from "node:crypto"

import { db } from "@/lib/database/prisma"
import { deleteObjectFromS3 } from "@/lib/storage/s3"
import {
  get17VinApplicableModels,
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
  PartSearchResponse,
  PartContentUpdateInput,
  SupplierBulkImageRow,
  SupplierBulkProductRow,
  SupplierPartCreateInput,
  SupplierPartLookupInput,
  SupplierPartLookupResult,
  SupplierOfferUpdateInput,
  SupplierPartRecord,
} from "@/types/parts-mapping/parts-mapping"

const DEFAULT_CURRENCY = "AED"

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const normalizeOptionalText = (value: unknown): string | null => {
  const normalized = normalizeText(value)
  return normalized || null
}

const normalizeVendorSku = (value: unknown): string =>
  normalizeText(value).toUpperCase()

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
}): SupplierPartRecord => ({
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
})

const normalizeInputNumbers = (input: {
  mpn?: string | null
  partNumber?: string | null
  oemNumber?: string | null
}) => {
  const originalMpn =
    normalizeOptionalText(input.mpn) ?? normalizeOptionalText(input.partNumber)
  const originalOemNumber = normalizeOptionalText(input.oemNumber)

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
  supplierBrand: string | null,
): Promise<string | null> => {
  const matches = await db.partNumberIndex.findMany({
    where: { numberNormalized: normalizedOemNumber },
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
      candidate.part.source !== "supplier_pending" &&
      brandsAreCompatible(supplierBrand, [
        candidate.brand,
        candidate.part.brandName,
      ]),
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
      candidate.source !== "supplier_pending" &&
      brandsAreCompatible(supplierBrand, [candidate.brandName]),
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
        "17VIN returned results, but none exactly matched the submitted OEM or MPN",
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
        "17VIN part number matched, but the supplier brand did not match",
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
  const brand = normalizeOptionalText(input.brand)
  const numbers = normalizeInputNumbers(input)

  if (!brand) {
    throw new Error("Brand is required")
  }
  if (!numbers.originalMpn || !numbers.originalOemNumber) {
    throw new Error("Both MPN and OEM number are required")
  }

  return { brand, ...numbers }
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
  const details = validateLookupInput(input)
  const localPartUid = await findLocalPartUid(
    details.normalizedOemNumber,
    details.normalizedMpn,
    details.brand,
  )

  if (localPartUid) {
    const [part, supplierOffer] = await Promise.all([
      db.partMaster.findUnique({ where: { partUid: localPartUid } }),
      db.supplierPart.findFirst({
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
  } catch (error) {
    vin17Error =
      error instanceof Error ? error.message : "17VIN lookup is unavailable"
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
      "No complete product exists locally. Complete the first-vendor product form.",
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
  const details = validateLookupInput(input)
  const price = parseMoney(input.price)
  const stock = parseStock(input.stock)
  let partUid = normalizeOptionalText(input.partUid)
  const completePartUid = normalizeOptionalText(input.completePartUid)
  let master = partUid
    ? await db.partMaster.findUnique({ where: { partUid } })
    : null
  let mappingSource: SupplierPartMappingSource =
    SupplierPartMappingSource.local_db
  let requiresAdminApproval = false

  if (master) {
    const matchingUid = await findLocalPartUid(
      details.normalizedOemNumber,
      details.normalizedMpn,
      details.brand,
    )
    if (matchingUid !== master.partUid) {
      throw new Error("The selected product does not match the submitted OEM, MPN, and brand")
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

    const localPartUid = await findLocalPartUid(
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
        // Complete first-vendor details are sufficient when 17VIN is unavailable.
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

  const existingOffer = await db.supplierPart.findFirst({
    where: { supplierId, partUid },
    orderBy: { updatedAt: "desc" },
  })
  const offerData = {
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
}

const resolveConfirmedBulkPart = async (
  row: SupplierBulkProductRow,
): Promise<BulkPartResolution> => {
  const normalizedOemNumber = normalizePartNumber(row.oemNumber)
  if (!normalizedOemNumber) {
    throw new Error("OEM Part Number is required")
  }

  const brand = normalizeOptionalText(row.brand)
  const localPartUid = await findConfirmedLocalPartUid(
    normalizedOemNumber,
    brand,
  )
  if (localPartUid) {
    return {
      partUid: localPartUid,
      mappingSource: SupplierPartMappingSource.local_db,
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
      matchError ?? "No exact OEM match was found in the local catalog or 17VIN",
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

  return { partUid, mappingSource: SupplierPartMappingSource.vin17 }
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

export async function importSupplierPartsBulk(
  supplierId: string,
  rows: SupplierBulkProductRow[],
) {
  const seenSkus = new Set<string>()
  const resolutionByOem = new Map<string, Promise<BulkPartResolution>>()

  const results = await mapWithConcurrency(rows, 5, async (row) => {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const oemNumber = normalizeOptionalText(row.oemNumber)

    if (!vendorSku || !oemNumber) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        oemNumber: oemNumber ?? "",
        reason: "Vendor SKU Number and OEM Part Number are required",
      }
    }
    if (seenSkus.has(vendorSku)) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        oemNumber,
        reason: "Duplicate Vendor SKU Number in this file",
      }
    }
    seenSkus.add(vendorSku)

    const normalizedOemNumber = normalizePartNumber(oemNumber)
    let resolutionPromise = resolutionByOem.get(normalizedOemNumber)
    if (!resolutionPromise) {
      resolutionPromise = resolveConfirmedBulkPart({ ...row, oemNumber })
      resolutionByOem.set(normalizedOemNumber, resolutionPromise)
    }

    try {
      const resolution = await resolutionPromise
      const master = await db.partMaster.findUniqueOrThrow({
        where: { partUid: resolution.partUid },
      })
      const originalMpn = normalizeOptionalText(row.mpn)
      const supplierPart = await db.supplierPart.upsert({
        where: { supplierId_vendorSku: { supplierId, vendorSku } },
        create: {
          supplierId,
          vendorSku,
          partUid: resolution.partUid,
          originalPartName: master.partName ?? `OEM ${oemNumber}`,
          originalBrand: master.brandName ?? normalizeOptionalText(row.brand),
          originalMpn,
          originalOemNumber: oemNumber,
          normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
          normalizedOemNumber,
          price: parseMoney(row.price ?? 0),
          stock: parseStock(row.stock ?? 0),
          currency: DEFAULT_CURRENCY,
          category: master.category,
          oemSupersessionNumbers: row.oemSupersessionNumbers ?? [],
          competitorPartNumber: normalizeOptionalText(row.competitorPartNumber),
          competitorBrandName: normalizeOptionalText(row.competitorBrandName),
          hsCode: normalizeOptionalText(row.hsCode),
          supplierImageUrls: row.imageUrls ?? [],
          mappingStatus: SupplierPartMappingStatus.mapped,
          mappingSource: resolution.mappingSource,
          mappingError: null,
          rawUploadData: parseJson(row.rawUploadData),
        },
        update: {
          partUid: resolution.partUid,
          originalPartName: master.partName ?? `OEM ${oemNumber}`,
          originalBrand: master.brandName ?? normalizeOptionalText(row.brand),
          originalMpn,
          originalOemNumber: oemNumber,
          normalizedMpn: originalMpn ? normalizePartNumber(originalMpn) : null,
          normalizedOemNumber,
          price: parseMoney(row.price ?? 0),
          stock: parseStock(row.stock ?? 0),
          currency: DEFAULT_CURRENCY,
          category: master.category,
          oemSupersessionNumbers: row.oemSupersessionNumbers ?? [],
          competitorPartNumber: normalizeOptionalText(row.competitorPartNumber),
          competitorBrandName: normalizeOptionalText(row.competitorBrandName),
          hsCode: normalizeOptionalText(row.hsCode),
          ...(row.imageUrls?.length
            ? { supplierImageUrls: row.imageUrls }
            : {}),
          mappingStatus: SupplierPartMappingStatus.mapped,
          mappingSource: resolution.mappingSource,
          mappingError: null,
          rawUploadData: parseJson(row.rawUploadData),
        },
      })

      return {
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku,
        oemNumber,
        mappingSource: resolution.mappingSource,
        part: await getSupplierPartById(supplierPart.id),
      }
    } catch (error) {
      return {
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        oemNumber,
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

  for (const row of rows) {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const supplierPart = vendorSku
      ? await db.supplierPart.findFirst({
          where: {
            supplierId,
            vendorSku: { equals: vendorSku, mode: "insensitive" },
          },
        })
      : null

    if (!supplierPart) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason: "No mapped product exists for this supplier SKU",
      })
      continue
    }

    await db.supplierPart.update({
      where: { id: supplierPart.id },
      data: {
        supplierImageUrls: [
          row.primaryImageUrl,
          ...row.galleryImageUrls,
        ],
      },
    })
    results.push({
      ok: true as const,
      rowNumber: row.rowNumber,
      vendorSku,
      part: await getSupplierPartById(supplierPart.id),
    })
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

export async function updateSupplierPartOffer(
  supplierId: string,
  supplierPartId: string,
  input: SupplierOfferUpdateInput,
) {
  const supplierPart = await db.supplierPart.findFirst({
    where: { id: supplierPartId, supplierId },
    select: { id: true },
  })

  if (!supplierPart) {
    throw new Error("Supplier part not found")
  }

  await db.supplierPart.update({
    where: { id: supplierPart.id },
    data: {
      price: parseMoney(input.price),
      stock: parseStock(input.stock),
      currency: DEFAULT_CURRENCY,
    },
  })

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
              ? "Uncertain 17VIN match needs admin review"
              : "No matching part found in local DB or 17VIN"),
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
  } catch (error) {
    return db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        mappingStatus: SupplierPartMappingStatus.failed,
        mappingError:
          error instanceof Error ? error.message : "17VIN mapping failed",
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
    },
  })

  return parts.map(mapSupplierPart)
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
