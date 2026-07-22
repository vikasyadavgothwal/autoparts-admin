import { get17VinApplicableModels, normalizePartNumber, type Vin17PartCandidate } from "@/lib/17vin"
import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
} from "@/lib/generated/prisma/client"
import type {
  SupplierPartCreateInput,
  SupplierPartLookupInput,
  SupplierPartLookupResult,
} from "@/types/parts-mapping/parts-mapping"
import {
  DEFAULT_CURRENCY,
  createPartNumberIndexIfMissing,
  findLocalPartUid,
  findOrCreatePartMasterFrom17Vin,
  findSupplierPartBySupplierOem,
  getSupplierPartById,
  makePartUid,
  normalizeOptionalText,
  normalizeRequiredProductText,
  normalizeText,
  parseJson,
  parseMoney,
  parseStock,
  partMasterSummary,
  pick17VinCandidate,
  resolvePartFromCompetitor,
  saveFitments,
  search17VinCandidates,
  validateLookupInput,
  type BulkPartResolution,
} from "./internal-helpers"

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

