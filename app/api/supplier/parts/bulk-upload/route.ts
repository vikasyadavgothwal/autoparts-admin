import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import { syncCatalogLookups } from "@/services/catalog/catalog-lookup-service"
import {
  importSupplierPartsBulk,
  updateSupplierPartPricingBulk,
  updateSupplierPartImagesBulk,
  updateSupplierPartStockBulk,
} from "@/services/parts-mapping"
import type {
  SupplierBulkImageRow,
  SupplierBulkPricingRow,
  SupplierBulkProductRow,
  SupplierBulkStockRow,
} from "@/types/parts-mapping/parts-mapping"
import type { CatalogLookupWorkbookData } from "@/types/catalog/lookups"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 1_000

const normalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")

const readCell = (row: Record<string, unknown>, aliases: string[]) => {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      return String(value ?? "").trim()
    }
  }
  return ""
}

const splitValues = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,;|\n]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeLookupId = (value: string) => {
  const normalized = value.trim()
  if (!/^\d+\.\d{8,}$/.test(normalized)) return normalized
  return Number(normalized).toFixed(10).replace(/0+$/, "").replace(/\.$/, "")
}

const normalizeImageUrl = (value: string) => {
  const trimmedValue = value.trim()
  const markdownLink = trimmedValue.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i)
  if (markdownLink?.[1]) {
    return markdownLink[1].trim()
  }

  const excelHyperlink = trimmedValue.match(
    /^=?HYPERLINK\(\s*"(https?:\/\/[^"]+)"/i,
  )
  if (excelHyperlink?.[1]) {
    return excelHyperlink[1].trim()
  }

  return trimmedValue
}

const parseSpreadsheet = async (file: File) => {
  if (file.size === 0) {
    throw new Error(`${file.name || "Upload file"} is empty`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name || "Upload file"} exceeds the 10 MB limit`)
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
    throw new Error("Only CSV, XLSX, and XLS files are supported")
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error(`${file.name} does not contain a worksheet`)
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[firstSheetName],
    { defval: "", raw: false },
  )
  if (rows.length === 0) {
    throw new Error(`${file.name} does not contain any data rows`)
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(`A single upload can contain at most ${MAX_ROWS} rows`)
  }
  return rows
}

const parseImageRows = async (file: File): Promise<SupplierBulkImageRow[]> => {
  const rows = await parseSpreadsheet(file)
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  const hasNumberedGalleryColumns = headers.some((header) =>
    /^galleryimage[1-5](url)?$/.test(header),
  )
  if (
    !headers.some((header) =>
      ["sku", "vendorsku", "vendorskunumber"].includes(header),
    ) ||
    !headers.includes("primaryimageurl") ||
    (!headers.includes("galleryimageurls") && !hasNumberedGalleryColumns)
  ) {
    throw new Error(
      "The image file must contain SKU, Primary Image URL, and either Gallery Image URLs or Gallery Image 1-5 columns",
    )
  }
  return rows.map((row, index) => {
    const vendorSku = readCell(row, ["SKU", "Vendor SKU", "Vendor SKU Number"])
    const primaryImageUrl = normalizeImageUrl(
      readCell(row, ["Primary Image URL", "Primary Image"]),
    )
    const galleryImageUrls = Array.from(
      new Set(
        [
          ...splitValues(
            readCell(row, ["Gallery Image URLs", "Gallery Images"]),
          ),
          ...Array.from({ length: 5 }, (_, imageIndex) =>
            readCell(row, [
              `Gallery Image ${imageIndex + 1}`,
              `Gallery Image ${imageIndex + 1} URL`,
            ]),
          ),
        ]
          .map(normalizeImageUrl)
          .filter(Boolean),
      ),
    )

    if (!vendorSku) {
      throw new Error(`Image row ${index + 2}: SKU is required`)
    }
    if (!primaryImageUrl) {
      throw new Error(`Image row ${index + 2}: Primary Image URL is required`)
    }
    if (galleryImageUrls.length > 5) {
      throw new Error(
        `Image row ${index + 2}: a maximum of 5 gallery images is allowed`,
      )
    }
    const imageUrls = Array.from(
      new Set([primaryImageUrl, ...galleryImageUrls]),
    )
    for (const imageUrl of imageUrls) {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(imageUrl)
      } catch {
        throw new Error(`Image row ${index + 2}: invalid image URL`)
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error(`Image row ${index + 2}: image URLs must use HTTP or HTTPS`)
      }
    }

    return {
      rowNumber: index + 2,
      vendorSku,
      primaryImageUrl,
      galleryImageUrls: imageUrls.slice(1),
    }
  })
}

const parseStockRows = async (file: File): Promise<SupplierBulkStockRow[]> => {
  const rows = await parseSpreadsheet(file)
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  const hasSkuColumn = headers.some((header) =>
    ["sku", "vendorsku", "vendorskunumber"].includes(header),
  )
  if (
    !hasSkuColumn ||
    !headers.includes("warehouseid") ||
    !headers.includes("quantity")
  ) {
    throw new Error(
      "The stock file must contain SKU, Warehouse ID, and Quantity columns",
    )
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    vendorSku: readCell(row, ["SKU", "Vendor SKU", "Vendor SKU Number"]),
    warehouseId: readCell(row, ["Warehouse ID", "Warehouse", "Warehouse Name"]),
    quantity: readCell(row, ["Quantity", "Stock", "Qty"]),
    leadTime: readCell(row, ["Lead Time", "Lead Time Days"]),
    lowStockThreshold: readCell(row, [
      "Low Stock Threshold",
      "Low Stock",
      "Reorder Threshold",
    ]),
    rawUploadData: { ...row },
  }))
}

const parsePricingRows = async (
  file: File,
): Promise<SupplierBulkPricingRow[]> => {
  const rows = await parseSpreadsheet(file)
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  const hasSkuColumn = headers.some((header) =>
    ["sku", "vendorsku", "vendorskunumber"].includes(header),
  )
  const hasBasePrice = headers.some((header) =>
    ["basepriceaed", "baseprice", "price"].includes(header),
  )
  const hasDiscountPrice = headers.some((header) =>
    ["discountpriceaed", "discountprice", "saleprice"].includes(header),
  )
  if (
    !hasSkuColumn ||
    (!hasBasePrice && !hasDiscountPrice)
  ) {
    throw new Error(
      "The pricing file must contain SKU and Base Price (AED) or Discount Price (AED) columns",
    )
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    vendorSku: readCell(row, ["SKU", "Vendor SKU", "Vendor SKU Number"]),
    basePrice: readCell(row, ["Base Price (AED)", "Base Price", "Price"]),
    discountPrice: readCell(row, [
      "Discount Price (AED)",
      "Discount Price",
      "Sale Price",
    ]),
    currency: readCell(row, ["Currency"]),
    taxClass: readCell(row, ["Tax Class"]),
    vat: readCell(row, ["VAT"]),
    maxRetailPrice: readCell(row, [
      "Max Retail Price",
      "MRP",
      "Maximum Retail Price",
    ]),
    wholesaleDistributorPrice: readCell(row, [
      "Wholesale/Distributor Pricing",
      "Wholesale Distributor Pricing",
      "Wholesale Pricing",
      "Distributor Pricing",
    ]),
    fleetPrice: readCell(row, ["Fleet Pricing", "Fleet Price"]),
    rawUploadData: { ...row },
  }))
}

const parseProductRows = (
  rows: Record<string, unknown>[],
  imageRows: SupplierBulkImageRow[],
): SupplierBulkProductRow[] => {
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  const hasSkuColumn = headers.some((header) =>
    ["sku", "vendorsku", "vendorskunumber"].includes(header),
  )
  const hasOemColumn = headers.some((header) =>
    ["oempartnumber", "oemnumber", "oem"].includes(header),
  )
  const hasMpnColumn = headers.some((header) =>
    [
      "manufacturerpartnumbermpn",
      "manufacturerpartnumber",
      "mpn",
      "partnumber",
    ].includes(header),
  )
  const hasCompetitorOemColumn = headers.some((header) =>
    [
      "competitoroempartnumber",
      "competitoroemnumber",
      "competitorpartnumber",
    ].includes(header),
  )
  const hasProductNameColumn = headers.includes("productname")
  if (
    !hasSkuColumn ||
    (!hasOemColumn && !hasCompetitorOemColumn && !(hasProductNameColumn && hasMpnColumn))
  ) {
    throw new Error(
      "The product file must contain SKU and either OEM/competitor fields or Product Name plus Manufacturer Part Number (MPN)",
    )
  }
  const imagesBySku = new Map(
    imageRows.map((row) => [
      row.vendorSku.trim().toUpperCase(),
      [row.primaryImageUrl, ...row.galleryImageUrls],
    ]),
  )

  return rows.map((row, index) => {
    const vendorSku = readCell(row, [
      "Vendor SKU Number",
      "Vendor SKU",
      "SKU",
    ])
    const oemNumber = readCell(row, [
      "OEM Part Number",
      "OEM Number",
      "OEM",
      "Cross References | OEM Part Number",
    ])
    const mpn = readCell(row, [
      "Manufacturer Part Number (MPN)",
      "Manufacturer Part Number",
      "MPN",
      "Part Number",
    ])
    const brand = readCell(row, [
      "Brand Name",
      "Product Brand Name",
      "Product Brand",
      "Brand",
    ])
    const rawUploadData = { ...row }
    for (const key of Object.keys(rawUploadData)) {
      if (normalizeHeader(key) === "platformpartnumbersku") {
        rawUploadData[key] = null
      }
    }

    return {
      rowNumber: index + 2,
      vendorSku,
      oemNumber,
      mpn,
      brand,
      price: readCell(row, [
        "Price",
        "Base Price (AED)",
        "Base Price",
        "Discount Price (AED)",
        "Discount Price",
        "Product Pricing | Discount Price (AED)",
        "Product Pricing | Base Price (AED)",
      ]),
      stock: readCell(row, [
        "Stock",
        "Quantity",
        "Qty",
        "Product Inventory | Quantity",
      ]),
      productName: readCell(row, ["Product Name", "Product"]),
      shortDescription: readCell(row, [
        "Short Description",
        "Product Short Description",
      ]),
      longDescription: readCell(row, [
        "Long Description",
        "Product Long Description",
        "Description",
      ]),
      status: readCell(row, ["Status"]),
      grade: readCell(row, ["Grade"]),
      condition: readCell(row, ["Condition"]),
      category: readCell(row, ["Category Name", "Category"]),
      oemSupersessionNumbers: splitValues(
        readCell(row, [
          "OEM Supersession Numbers",
          "Supersession Numbers",
          "Cross References | OEM Supersession Numbers",
        ]),
      ),
      competitorPartNumber: readCell(row, [
        "Competitor OEM Part Number",
        "Competitor OEM Number",
        "Competitor Part Number",
        "Cross References | Competitor Part Number",
      ]),
      competitorBrandName: readCell(row, [
        "Competitor Brand Name",
        "Cross References | Competitor Brand Name",
      ]),
      hsCode: readCell(row, [
        "HS Code",
        "Harmonized System Code",
        "Cross References | HS Code",
        "Shipping Logistics | HS Code",
      ]),
      imageUrls:
        imagesBySku.get(vendorSku.trim().toUpperCase()) ??
        [
          normalizeImageUrl(
            readCell(row, [
              "Product Images | Primary Image URL",
              "Primary Image URL",
            ]),
          ),
          ...splitValues(
            readCell(row, [
              "Product Images | Gallery Image URLs",
              "Gallery Image URLs",
            ]),
          ).map(normalizeImageUrl),
        ].filter(Boolean),
      rawUploadData,
    }
  })
}

const rowsFromSheet = (
  workbook: XLSX.WorkBook,
  sheetName: string,
): Record<string, unknown>[] => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`The workbook is missing ${sheetName}`)
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  })
}

const parseUnifiedWorkbook = async (file: File) => {
  if (file.size === 0) throw new Error("The selected workbook is empty")
  if (file.size > MAX_FILE_BYTES) throw new Error("The workbook exceeds 10 MB")
  if (file.name.split(".").pop()?.toLowerCase() !== "xlsx") {
    throw new Error("Upload the Product Master XLSX template")
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  })
  const productRows = rowsFromSheet(workbook, "Product_Master")
  if (productRows.length > MAX_ROWS) {
    throw new Error(`A single upload can contain at most ${MAX_ROWS} rows`)
  }

  const categoryRows = rowsFromSheet(workbook, "Lookup_Categories")
  const vehicleRows = rowsFromSheet(workbook, "Lookup_Vehicles")
  const brandRows = rowsFromSheet(workbook, "Lookup_Brands")
  const gradeRows = rowsFromSheet(workbook, "Lookup_Grades")

  const lookups: CatalogLookupWorkbookData = {
    categories: categoryRows.map((row) => ({
      id: normalizeLookupId(readCell(row, ["Category ID"])),
      name: readCell(row, ["Category Name"]),
      parentId:
        normalizeLookupId(readCell(row, ["Parent Category"])) || null,
    })),
    vehicles: vehicleRows.map((row) => ({
      id: readCell(row, ["Vehicle ID"]),
      make: readCell(row, ["Make"]),
      model: readCell(row, ["Model"]),
      tierLabel: readCell(row, ["Tier"]) || null,
    })),
    brands: brandRows.map((row) => ({
      id: readCell(row, ["Brand ID"]),
      brandName: readCell(row, ["Brand Name"]),
      categoryNames: splitValues(readCell(row, ["Product Categories"])),
      tierLabel: readCell(row, ["Tier"]) || null,
    })),
    grades: gradeRows.map((row) => ({
      customerFacingLabel: readCell(row, ["Customer-Facing Label"]),
      description: readCell(row, ["Description"]) || null,
    })),
  }

  for (const row of productRows) {
    const categoryId = normalizeLookupId(readCell(row, ["Category ID"]))
    const categoryName = readCell(row, ["Category Name"])
    if (
      categoryId &&
      categoryName &&
      !lookups.categories.some((category) => category.id === categoryId)
    ) {
      lookups.categories.push({
        id: categoryId,
        name: categoryName,
        parentId:
          normalizeLookupId(readCell(row, ["Parent Category"])) || null,
      })
    }

    const brandId = readCell(row, ["Brand ID"])
    const brandName = readCell(row, ["Brand Name"])
    if (
      brandId &&
      brandName &&
      !lookups.brands.some((brand) => brand.id === brandId)
    ) {
      lookups.brands.push({
        id: brandId,
        brandName,
        categoryNames: splitValues(readCell(row, ["Product Categories"])),
        tierLabel: readCell(row, ["Tier", "Tier 1"]) || null,
      })
    }

    const ids = splitLines(readCell(row, ["Vehicle ID"]))
    const makes = splitLines(readCell(row, ["Vehicle Fitment | Make"]))
    const models = splitLines(readCell(row, ["Vehicle Fitment | Model"]))
    ids.forEach((id, index) => {
      if (!lookups.vehicles.some((vehicle) => vehicle.id === id)) {
        lookups.vehicles.push({
          id,
          make: makes[index] ?? makes[0] ?? "Unknown",
          model: models[index] ?? models[0] ?? "Unknown",
          tierLabel: readCell(row, ["Tier", "Tier 1"]) || null,
        })
      }
    })
  }

  return { productRows, lookups }
}

const getUploadedFile = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : null
}

const createUnmappedWorkbookBase64 = (
  rows: Array<{
    rowNumber: number
    vendorSku: string
    oemNumber?: string | null
    brand?: string | null
    competitorPartNumber?: string | null
    competitorBrandName?: string | null
    reason: string
  }>,
) => {
  if (rows.length === 0) return null
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      "Source Row": row.rowNumber,
      "Vendor SKU": row.vendorSku,
      "OEM Part Number": row.oemNumber ?? "",
      "Brand Name": row.brand ?? "",
      "Competitor Part Number": row.competitorPartNumber ?? "",
      "Competitor Brand Name": row.competitorBrandName ?? "",
      "Mapping Status": "Unmapped",
      "Reason": row.reason,
    })),
  )
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 60 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Unmapped_Products")
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" })
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const formData = await request.formData()
    const workbookFile = getUploadedFile(formData, "workbookFile")

    if (workbookFile) {
      const parsed = await parseUnifiedWorkbook(workbookFile)
      const lookupSummary = await syncCatalogLookups(parsed.lookups)
      const catalogRows = parsed.productRows.filter((row) =>
        Boolean(
          readCell(row, ["Product Name"]) ||
            readCell(row, ["Manufacturer Part Number (MPN)"]) ||
            readCell(row, ["Cross References | OEM Part Number"]),
        ),
      )
      if (catalogRows.length === 0) {
        throw new Error("Product_Master does not contain product rows")
      }

      const products = parseProductRows(catalogRows, [])
      const summary = await importSupplierPartsBulk(auth.user.id, products)

      const stockRows: SupplierBulkStockRow[] = catalogRows
        .map((row, index) => ({
          rowNumber: index + 2,
          vendorSku: readCell(row, ["SKU"]),
          warehouseId: readCell(row, [
            "Product Inventory | Warehouse ID",
          ]),
          quantity: readCell(row, ["Product Inventory | Quantity"]),
          leadTime: readCell(row, ["Product Inventory | Lead Time"]),
          lowStockThreshold: readCell(row, [
            "Product Inventory | Low Stock Threshold",
          ]),
          rawUploadData: { ...row },
        }))
        .filter((row) => row.vendorSku && row.warehouseId && row.quantity !== "")
      const pricingRows: SupplierBulkPricingRow[] = catalogRows
        .map((row, index) => ({
          rowNumber: index + 2,
          vendorSku: readCell(row, ["SKU"]),
          basePrice: readCell(row, [
            "Product Pricing | Base Price (AED)",
          ]),
          discountPrice: readCell(row, [
            "Product Pricing | Discount Price (AED)",
          ]),
          currency: readCell(row, ["Product Pricing | Currency"]),
          taxClass: readCell(row, ["Product Pricing | Tax Class"]),
          vat: readCell(row, ["Product Pricing | VAT"]),
          maxRetailPrice: readCell(row, [
            "Product Pricing | Max Retail Price",
          ]),
          wholesaleDistributorPrice: readCell(row, [
            "Product Pricing | Wholesale/Distributor Pricing",
          ]),
          fleetPrice: readCell(row, ["Product Pricing | Fleet Pricing"]),
          rawUploadData: { ...row },
        }))
        .filter(
          (row) =>
            row.vendorSku &&
            (row.basePrice !== "" || row.discountPrice !== ""),
        )

      const stockSummary = stockRows.length
        ? await updateSupplierPartStockBulk(auth.user.id, stockRows)
        : null
      const pricingSummary = pricingRows.length
        ? await updateSupplierPartPricingBulk(auth.user.id, pricingRows)
        : null

      return NextResponse.json({
        ok: true,
        mode: "products",
        summary: {
          ...summary,
          lookupSummary,
          stockUpdatedCount: stockSummary?.updatedCount ?? 0,
          pricingUpdatedCount: pricingSummary?.updatedCount ?? 0,
          ignoredBundleRows: parsed.productRows.length - catalogRows.length,
          unmatchedImageRows: [],
          unmappedWorkbookBase64: createUnmappedWorkbookBase64(
            summary.unmapped,
          ),
        },
      })
    }

    const mode = String(formData.get("mode") ?? "products")
    const imageFile = getUploadedFile(formData, "imageFile")
    const stockFile = getUploadedFile(formData, "stockFile")
    const pricingFile = getUploadedFile(formData, "pricingFile")

    if (mode === "images") {
      if (!imageFile) {
        return NextResponse.json(
          { ok: false, message: "Select an image mapping CSV or Excel file" },
          { status: 400 },
        )
      }
      const summary = await updateSupplierPartImagesBulk(
        auth.user.id,
        await parseImageRows(imageFile),
      )
      return NextResponse.json({ ok: true, mode, summary })
    }

    if (mode === "stock") {
      if (!stockFile) {
        return NextResponse.json(
          { ok: false, message: "Select a stock CSV or Excel file" },
          { status: 400 },
        )
      }
      const summary = await updateSupplierPartStockBulk(
        auth.user.id,
        await parseStockRows(stockFile),
      )
      return NextResponse.json({ ok: true, mode, summary })
    }

    if (mode === "pricing") {
      if (!pricingFile) {
        return NextResponse.json(
          { ok: false, message: "Select a pricing CSV or Excel file" },
          { status: 400 },
        )
      }
      const summary = await updateSupplierPartPricingBulk(
        auth.user.id,
        await parsePricingRows(pricingFile),
      )
      return NextResponse.json({ ok: true, mode, summary })
    }

    const productFile = getUploadedFile(formData, "productFile")
    if (!productFile) {
      return NextResponse.json(
        { ok: false, message: "Select a product CSV or Excel file" },
        { status: 400 },
      )
    }

    const imageRows = imageFile ? await parseImageRows(imageFile) : []
    const productRows = parseProductRows(
      await parseSpreadsheet(productFile),
      imageRows,
    )
    const summary = await importSupplierPartsBulk(auth.user.id, productRows)
    const productSkus = new Set(
      productRows.map((row) => row.vendorSku.trim().toUpperCase()),
    )
    const unmatchedImageRows = imageRows
      .filter((row) => !productSkus.has(row.vendorSku.trim().toUpperCase()))
      .map((row) => ({
        rowNumber: row.rowNumber,
        vendorSku: row.vendorSku,
        reason: "SKU was not present in the product upload",
      }))

    return NextResponse.json({
      ok: true,
      mode: "products",
      summary: { ...summary, unmatchedImageRows },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Bulk upload failed",
      },
      { status: 400 },
    )
  }
}
