import * as XLSX from "xlsx"

import { db } from "@/lib/database/prisma"
import { SupplierPartMappingStatus } from "@/lib/generated/prisma/client"

type ExportFormat = "csv" | "xlsx"

type ExportSheet = {
  name: string
  rows: Array<Record<string, string | number>>
  columns: string[]
}

type ExportResult = {
  payload: Buffer
  filename: string
  contentType: string
  format: ExportFormat
}

const toMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ""
  return (value / 100).toString()
}

const makeFileName = (prefix: string, format: ExportFormat) => {
  const date = new Date().toISOString().split("T")[0]
  return `${prefix}-${date}.${format === "xlsx" ? "xlsx" : "csv"}`
}

const toCsvSafe = (value: unknown) => {
  if (value === null || value === undefined) return ""
  const text = String(value).replace(/\r?\n/g, " ")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const toCsv = (columns: string[], rows: Array<Record<string, string | number>>) => {
  const header = columns.join(",")
  const lines = rows.map((row) =>
    columns.map((column) => toCsvSafe(row[column] ?? "")).join(","),
  )
  return `${header}\n${lines.join("\n")}`
}

const buildCsvExport = (sheets: ExportSheet[]): { format: "csv"; contentType: string; payload: Buffer } => {
  const [primarySheet, ...additionalSheets] = sheets
  const primaryCsv = primarySheet ? toCsv(primarySheet.columns, primarySheet.rows) : ""

  const extras = additionalSheets
    .map((sheet) =>
      `\n\n# ${sheet.name}\n${toCsv(sheet.columns, sheet.rows)}`
        .trim()
    )
    .join("\n\n")

  return {
    format: "csv",
    contentType: "text/csv; charset=utf-8",
    payload: Buffer.from(`${primaryCsv}${extras ? `\n\n${extras}` : ""}`),
  }
}

const buildXlsxExport = (sheets: ExportSheet[]) => {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const xlsxRows = sheet.rows.length
      ? sheet.rows
      : [Object.fromEntries(sheet.columns.map((column) => [column, ""]))]
    const worksheet = XLSX.utils.json_to_sheet(xlsxRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  return Buffer.from(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
  )
}

const mapSheetRows = (supplierId: string, requireMapped = false) =>
  db.supplierPart.findMany({
    where: {
      supplierId,
      ...(requireMapped ? { mappingStatus: SupplierPartMappingStatus.mapped } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      part: {
        select: {
          partUid: true,
          partName: true,
          partNumber: true,
          brandName: true,
          category: true,
          source: true,
        },
      },
      pricing: {
        select: {
          basePrice: true,
          discountPrice: true,
          currency: true,
          taxClass: true,
          vat: true,
          maxRetailPrice: true,
          wholesaleDistributorPrice: true,
          fleetPrice: true,
          rawUploadData: true,
        },
      },
      stockRows: {
        orderBy: [{ warehouseId: "asc" }],
        select: {
          vendorSku: true,
          warehouseId: true,
          quantity: true,
          leadTime: true,
          lowStockThreshold: true,
        },
      },
    },
  })

const productMasterColumns = [
  "SKU", "Product Name", "Short Description", "Long Description",
  "Manufacturer Part Number (MPN)", "Status", "Grade", "Condition",
  "Category ID", "Category Name", "Parent Category", "Brand ID", "Brand Name",
  "Product Categories", "Tier 1", "Attribute Name", "Attribute Value",
  "Detailed Attributes", "Attribute Name (B)", "Attribute Name (C)", "Vehicle ID",
  "Vehicle Fitment | Make", "Vehicle Fitment | Model", "Vehicle Fitment | Year_Start",
  "Vehicle Fitment | Year_End", "Vehicle Fitment | Engine", "Vehicle Fitment | Trim",
  "Vehicle Fitment | Drive_Type", "Vehicle Fitment | Fitment Notes",
  "Product Pricing | Base Price (AED)", "Product Pricing | Discount Price (AED)",
  "Product Pricing | Currency", "Product Pricing | Tax Class", "Product Pricing | VAT",
  "Product Pricing | Max Retail Price", "Product Pricing | Wholesale/Distributor Pricing",
  "Product Pricing | Fleet Pricing", "Product Inventory | Warehouse ID",
  "Product Inventory | Quantity", "Product Inventory | Lead Time",
  "Product Inventory | Low Stock Threshold", "Product Images | Primary Image URL",
  "Product Images | Gallery Image URLs", "Product Documents | Document Type",
  "Product Documents | Document URL", "Cross References | Platform Part number (SKU)",
  "Cross References | OEM Part Number", "Cross References | OEM Supersession Numbers",
  "Cross References | Competitor Part Number", "Cross References | Competitor Brand Name",
  "Cross References | HS Code", "Product Bundles | Component SKU",
  "Product Bundles | Quantity in Bundle", "Product Bundles | Parent Bundle SKU",
  "Product Bundles | Quantity as Component", "Shipping Logistics | Weight (kg)",
  "Shipping Logistics | Length (cm)", "Shipping Logistics | Width (cm)",
  "Shipping Logistics | Height (cm)", "Shipping Logistics | HS Code",
  "Shipping Logistics | Country of Origin", "Compliance | Warranty Period (Months)",
  "Compliance | Certification (e.g., ESMA)", "Marketplace Settings | Allow Backorders (Yes/No)",
  "Marketplace Settings | Max Order Quantity", "Marketplace Settings | Is Active (Yes/No)",
  "Upload Validation | Validation Status", "Upload Validation | Missing Fields",
]

const emptyLookupSheets = [
  ["Lookup_Categories", ["Category ID", "Category Name", "Parent Category"]],
  ["Lookup_Vehicles", ["Vehicle ID", "Make", "Model", "Tier"]],
  ["Lookup_Brands", ["Brand ID", "Brand Name", "Product Categories", "Tier"]],
  ["Lookup_Grades", ["Customer-Facing Label", "Description"]],
  ["Lookup_SKU_Numbers", ["Srl. Nos.", "Category", "Category Code", "Subcategory", "Subcategory Code", "SKU Prefix"]],
  ["Test_Expected_Results", ["17VIN-Verified Toyota Two-Product Update Test"]],
  ["Sources", ["17VIN-Verified Toyota EPC Sample Data"]],
] as const

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const exportValue = (value: unknown): string | number => {
  if (Array.isArray(value)) return value.join(", ")
  if (value === null || value === undefined) return ""
  return typeof value === "number" ? value : String(value)
}

const currentOrRaw = (
  current: unknown,
  raw: Record<string, unknown>,
  key: string,
) => current === null || current === undefined || current === "" ? raw[key] ?? "" : current

const buildProductMasterRow = (
  part: Awaited<ReturnType<typeof mapSheetRows>>[number],
) => {
  const raw = {
    ...toObject(part.rawUploadData),
    ...toObject(part.pricing?.rawUploadData),
  }
  const stock = part.stockRows[0]
  const imageUrls = part.supplierImageUrls
  const basePrice = part.pricing?.basePrice ?? (!part.pricing ? part.price : null)

  const row: Record<string, unknown> = {
    ...raw,
    SKU: part.vendorSku,
    "Product Name": part.originalPartName,
    "Manufacturer Part Number (MPN)": currentOrRaw(part.originalMpn, raw, "Manufacturer Part Number (MPN)"),
    Status: part.mappingStatus,
    "Brand Name": currentOrRaw(part.originalBrand, raw, "Brand Name"),
    "Category Name": currentOrRaw(part.category, raw, "Category Name"),
    "Product Pricing | Base Price (AED)": toMoney(basePrice),
    "Product Pricing | Discount Price (AED)": toMoney(part.pricing?.discountPrice),
    "Product Pricing | Currency": part.pricing?.currency ?? part.currency ?? "AED",
    "Product Pricing | Tax Class": part.pricing?.taxClass ?? currentOrRaw(null, raw, "Product Pricing | Tax Class"),
    "Product Pricing | VAT": part.pricing?.vat ?? currentOrRaw(null, raw, "Product Pricing | VAT"),
    "Product Pricing | Max Retail Price": toMoney(part.pricing?.maxRetailPrice),
    "Product Pricing | Wholesale/Distributor Pricing": toMoney(part.pricing?.wholesaleDistributorPrice),
    "Product Pricing | Fleet Pricing": toMoney(part.pricing?.fleetPrice),
    "Product Inventory | Warehouse ID": stock?.warehouseId ?? currentOrRaw(null, raw, "Product Inventory | Warehouse ID"),
    "Product Inventory | Quantity": part.stock,
    "Product Inventory | Lead Time": stock?.leadTime ?? currentOrRaw(null, raw, "Product Inventory | Lead Time"),
    "Product Inventory | Low Stock Threshold": stock?.lowStockThreshold ?? currentOrRaw(null, raw, "Product Inventory | Low Stock Threshold"),
    "Product Images | Primary Image URL": imageUrls[0] ?? currentOrRaw(null, raw, "Product Images | Primary Image URL"),
    "Product Images | Gallery Image URLs": imageUrls.slice(1).join(", ") || currentOrRaw(null, raw, "Product Images | Gallery Image URLs"),
    "Cross References | OEM Part Number": currentOrRaw(part.originalOemNumber, raw, "Cross References | OEM Part Number"),
    "Cross References | OEM Supersession Numbers": part.oemSupersessionNumbers.join(", "),
    "Cross References | Competitor Part Number": currentOrRaw(part.competitorPartNumber, raw, "Cross References | Competitor Part Number"),
    "Cross References | Competitor Brand Name": currentOrRaw(part.competitorBrandName, raw, "Cross References | Competitor Brand Name"),
    "Cross References | HS Code": currentOrRaw(part.hsCode, raw, "Cross References | HS Code"),
    "Shipping Logistics | HS Code": currentOrRaw(part.hsCode, raw, "Shipping Logistics | HS Code"),
  }

  return Object.fromEntries(
    productMasterColumns.map((column) => [column, exportValue(row[column])]),
  )
}

const buildExportResult = (
  sheets: ExportSheet[],
  filenamePrefix: string,
): ExportResult => {
  try {
    const payload = buildXlsxExport(sheets)
    return {
      payload,
      format: "xlsx",
      filename: makeFileName(filenamePrefix, "xlsx"),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  } catch {
    const primary = buildCsvExport(sheets)
    return {
      payload: primary.payload,
      format: "csv",
      filename: makeFileName(filenamePrefix, "csv"),
      contentType: primary.contentType,
    }
  }
}

export async function buildSupplierCatalogueExport(supplierId: string): Promise<ExportResult> {
  return buildSupplierProductMasterExport(supplierId, "supplier-catalogue")
}

export async function buildSupplierInventoryStockPriceExport(
  supplierId: string,
): Promise<ExportResult> {
  return buildSupplierProductMasterExport(supplierId, "supplier-inventory-stock-prices")
}

export async function buildSupplierProductMasterCsvExport(
  supplierId: string,
): Promise<ExportResult> {
  const parts = await mapSheetRows(supplierId, true)
  const rows = parts.map(buildProductMasterRow)

  return {
    payload: Buffer.from(toCsv(productMasterColumns, rows)),
    format: "csv",
    filename: makeFileName("supplier-product-master", "csv"),
    contentType: "text/csv; charset=utf-8",
  }
}

async function buildSupplierProductMasterExport(
  supplierId: string,
  filenamePrefix: string,
): Promise<ExportResult> {
  const parts = await mapSheetRows(supplierId, true)
  return buildExportResult(
    [
      {
        name: "Product_Master",
        rows: parts.map(buildProductMasterRow),
        columns: productMasterColumns,
      },
      ...emptyLookupSheets.map(([name, columns]) => ({
        name,
        rows: [],
        columns: [...columns],
      })),
    ],
    filenamePrefix,
  )
}
