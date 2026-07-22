import { normalizePartNumber } from "@/lib/17vin"
import { db } from "@/lib/database/prisma"
import { SupplierPartMappingStatus } from "@/lib/generated/prisma/client"
import { syncCatalogLookups } from "@/services/catalog/catalog-lookup-service"
import type {
  SupplierBulkProductRow,
  SupplierProductMasterInput,
} from "@/types/parts-mapping/parts-mapping"
import {
  DEFAULT_CURRENCY,
  findSupplierPartBySupplierOem,
  getSupplierPartById,
  normalizeOptionalText,
  normalizeRequiredProductText,
  normalizeText,
  normalizeVendorSku,
  parseJson,
  parseOptionalMoney,
  parseOptionalNonNegativeWholeNumber,
  parseStock,
  resolveConfirmedBulkPart,
  resolvePartFromCompetitor,
  splitProductMasterValues,
  uploadSupplierImageUrlsToS3,
  validateHttpUrl,
  type BulkPartResolution,
} from "./internal-helpers"

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

