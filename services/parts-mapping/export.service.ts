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

const buildCatalogRows = (part: Awaited<ReturnType<typeof mapSheetRows>>[number]) => ({
  "Supplier Part ID": part.id,
  "Catalog Product UID": part.part?.partUid ?? "",
  SKU: part.vendorSku ?? "",
  "Product Name": part.part?.partName ?? part.originalPartName,
  Brand: part.part?.brandName ?? part.originalBrand ?? "",
  "Part Number (MPN)": part.originalMpn ?? "",
  "OEM Number": part.originalOemNumber ?? "",
  Category: part.category ?? "",
  Status: part.mappingStatus,
  "Catalog Source": part.part?.source ?? "",
  "Base Price (AED)": toMoney(part.pricing?.basePrice),
  "Discount Price (AED)": toMoney(part.pricing?.discountPrice),
  Stock: part.stock,
  Currency: part.pricing?.currency ?? part.currency ?? "",
  "Tax Class": part.pricing?.taxClass ?? "",
  VAT: part.pricing?.vat ?? "",
  "Max Retail Price (AED)": toMoney(part.pricing?.maxRetailPrice),
  "Wholesale/Distributor Pricing (AED)": toMoney(part.pricing?.wholesaleDistributorPrice),
  "Fleet Price (AED)": toMoney(part.pricing?.fleetPrice),
  "Created At": part.createdAt.toISOString(),
  "Updated At": part.updatedAt.toISOString(),
})

const stockRowsFromPart = (
  part: Awaited<ReturnType<typeof mapSheetRows>>[number],
) => {
  if (part.stockRows.length > 0) {
    return part.stockRows.map((stockRow) => ({
      "Supplier Part ID": part.id,
      SKU: stockRow.vendorSku,
      "Warehouse ID": stockRow.warehouseId,
      Quantity: stockRow.quantity,
      "Lead Time": stockRow.leadTime ?? "",
      "Low Stock Threshold": stockRow.lowStockThreshold ?? "",
    }))
  }

  return [
    {
      "Supplier Part ID": part.id,
      SKU: part.vendorSku ?? "",
      "Warehouse ID": "",
      Quantity: part.stock,
      "Lead Time": "",
      "Low Stock Threshold": "",
    },
  ]
}

const pricingRowsFromPart = (
  part: Awaited<ReturnType<typeof mapSheetRows>>[number],
) => ({
  "Supplier Part ID": part.id,
  SKU: part.vendorSku ?? "",
  "Base Price (AED)": toMoney(part.pricing?.basePrice),
  "Discount Price (AED)": toMoney(part.pricing?.discountPrice),
  Currency: part.pricing?.currency ?? part.currency ?? "AED",
  "Tax Class": part.pricing?.taxClass ?? "",
  VAT: part.pricing?.vat ?? "",
  "Max Retail Price (AED)": toMoney(part.pricing?.maxRetailPrice),
  "Wholesale/Distributor Price (AED)": toMoney(
    part.pricing?.wholesaleDistributorPrice,
  ),
  "Fleet Price (AED)": toMoney(part.pricing?.fleetPrice),
})

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
  const parts = await mapSheetRows(supplierId, true)
  const rows = parts.map(buildCatalogRows)
  return buildExportResult([
    {
      name: "Catalogue",
      rows,
      columns: [
        "Supplier Part ID",
        "Catalog Product UID",
        "SKU",
        "Product Name",
        "Brand",
        "Part Number (MPN)",
        "OEM Number",
        "Category",
        "Status",
        "Catalog Source",
        "Base Price (AED)",
        "Discount Price (AED)",
        "Stock",
        "Currency",
        "Tax Class",
        "VAT",
        "Max Retail Price (AED)",
        "Wholesale/Distributor Pricing (AED)",
        "Fleet Price (AED)",
        "Created At",
        "Updated At",
      ],
    },
  ], "supplier-catalogue")
}

export async function buildSupplierInventoryStockPriceExport(
  supplierId: string,
): Promise<ExportResult> {
  const parts = await mapSheetRows(supplierId, true)
  const stockRows = parts.flatMap(stockRowsFromPart)
  const pricingRows = parts.map(pricingRowsFromPart)
  return buildExportResult(
    [
      {
        name: "Stock",
        rows: stockRows,
        columns: [
          "Supplier Part ID",
          "SKU",
          "Warehouse ID",
          "Quantity",
          "Lead Time",
          "Low Stock Threshold",
        ],
      },
      {
        name: "Pricing",
        rows: pricingRows,
        columns: [
          "Supplier Part ID",
          "SKU",
          "Base Price (AED)",
          "Discount Price (AED)",
          "Currency",
          "Tax Class",
          "VAT",
          "Max Retail Price (AED)",
          "Wholesale/Distributor Price (AED)",
          "Fleet Price (AED)",
        ],
      },
    ],
    "supplier-inventory-stock-prices",
  )
}

