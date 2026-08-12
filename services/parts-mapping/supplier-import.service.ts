import { normalizePartNumber } from "@/lib/vin-17-api-client"
import { db } from "@/lib/database/prisma"
import {
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
} from "@/lib/generated/prisma/client"
import type {
  SupplierBulkPricingRow,
  SupplierBulkProductRow,
  SupplierBulkStockRow,
  SupplierOfferUpdateInput,
} from "@/types/parts-mapping/parts-mapping"
import {
  DEFAULT_CURRENCY,
  SupplierImageUploadError,
  createSupplierPartSkuResolver,
  findSupplierPartBySupplierOem,
  getSupplierPartById,
  hasSupplierProductInfo,
  hasUploadedValue,
  isSupplierOemConflictError,
  mapWithConcurrency,
  normalizeBrandToken,
  normalizeOptionalText,
  normalizeVendorSku,
  parseJson,
  parseMoney,
  parseNonNegativeWholeNumber,
  parseOptionalMoney,
  parseOptionalNonNegativeWholeNumber,
  parseStock,
  resolveConfirmedBulkPart,
  resolvePartFromCompetitor,
  upsertPendingSupplierProductInfo,
  withUploadedSupplierImageUrls,
  type BulkPartResolution,
} from "./internal-helpers"

const supplierFacingUnmappedReason = (reason: string) => {
  const normalized = reason.trim()
  if (
    /17VIN/i.test(normalized) ||
    /VIN API/i.test(normalized) ||
    /brand lookup/i.test(normalized) ||
    /route/i.test(normalized) ||
    /not confirmed/i.test(normalized) ||
    /no exact/i.test(normalized) ||
    /unable to confirm/i.test(normalized)
  ) {
    return "OEM part not found"
  }
  return normalized || "OEM part not found"
}

const SUPPLIER_IMPORT_CONCURRENCY = 8

export async function importSupplierPartsBulk(
  supplierId: string,
  rows: SupplierBulkProductRow[],
) {
  const seenSkus = new Set<string>()
  const seenOemNumbers = new Map<string, string>()
  const resolutionByLookup = new Map<string, Promise<BulkPartResolution>>()

  const results = await mapWithConcurrency(rows, SUPPLIER_IMPORT_CONCURRENCY, async (row) => {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const oemNumber = normalizeOptionalText(row.oemNumber)
    const supplierBrand = normalizeOptionalText(row.brand)
    const competitorOem = normalizeOptionalText(row.competitorPartNumber)
    const competitorBrand = normalizeOptionalText(row.competitorBrandName)
    const hasProductInfo = hasSupplierProductInfo(row)
    const existingSkuOffer = await db.supplierPart.findUnique({
      where: { supplierId_vendorSku: { supplierId, vendorSku } },
      select: {
        id: true,
        vendorSku: true,
        partUid: true,
        originalOemNumber: true,
        originalBrand: true,
        mappingSource: true,
        mappingStatus: true,
      },
    })
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
    if (
      !oemNumber &&
      (!supplierBrand || !competitorOem) &&
      !hasProductInfo &&
      !(existingSkuOffer?.partUid && existingSkuOffer.mappingStatus === SupplierPartMappingStatus.mapped)
    ) {
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
      if (existingSkuOffer?.partUid && existingSkuOffer.mappingStatus === SupplierPartMappingStatus.mapped) {
        const updatedExistingOffer = await db.supplierPart.update({
          where: { id: existingSkuOffer.id },
          data: {
            ...(hasUploadedValue(row.price) ? { price: parseMoney(row.price ?? 0) } : {}),
            ...(hasUploadedValue(row.stock) ? { stock: parseStock(row.stock ?? 0) } : {}),
            rawUploadData: parseJson(row.rawUploadData),
          },
        })

        return {
          ok: true as const,
          rowNumber: row.rowNumber,
          vendorSku,
          brand: existingSkuOffer.originalBrand ?? supplierBrand,
          oemNumber: existingSkuOffer.originalOemNumber ?? oemNumber ?? "",
          mappingSource: existingSkuOffer.mappingSource ?? SupplierPartMappingSource.local_db,
          part: await getSupplierPartById(updatedExistingOffer.id),
        }
      }

      rowForPersistence = await withUploadedSupplierImageUrls(
        supplierId,
        vendorSku,
        row,
      )

      if (
        !oemNumber &&
        (!supplierBrand || !competitorOem) &&
        !(existingSkuOffer?.partUid && existingSkuOffer.mappingStatus === SupplierPartMappingStatus.mapped)
      ) {
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
          reason: "OEM part not found",
        }
      }

      const lookupKey = oemNumber
        ? `oem:${normalizePartNumber(oemNumber)}:${normalizeBrandToken(supplierBrand ?? "")}`
        : `competitor:${normalizePartNumber(competitorOem ?? "")}:${normalizeBrandToken(supplierBrand ?? "")}:${normalizeBrandToken(competitorBrand ?? "")}`
      let resolutionPromise = resolutionByLookup.get(lookupKey)
      if (!resolutionPromise) {
        const existingMappedResolution =
          existingSkuOffer?.partUid &&
          existingSkuOffer.mappingStatus === SupplierPartMappingStatus.mapped
            ? {
                partUid: existingSkuOffer.partUid,
                mappingSource:
                  existingSkuOffer.mappingSource ?? SupplierPartMappingSource.local_db,
                resolvedOemNumber:
                  existingSkuOffer.originalOemNumber ?? oemNumber ?? "",
                resolvedBrand: existingSkuOffer.originalBrand ?? supplierBrand,
              }
            : null
        resolutionPromise = existingMappedResolution
          ? Promise.resolve(existingMappedResolution)
          : oemNumber
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
        const reason = supplierFacingUnmappedReason(
          error instanceof Error ? error.message : "Unable to confirm this OEM",
        )
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
          supplierFacingUnmappedReason(
            error instanceof Error ? error.message : "Unable to confirm this OEM",
          ),
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
