import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth"
import {
  importSupplierPartsBulk,
  updateSupplierPartImagesBulk,
} from "@/services/parts-mapping/parts-mapping-service"
import type {
  SupplierBulkImageRow,
  SupplierBulkProductRow,
} from "@/types/parts-mapping/parts-mapping"

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
  if (!headers.some((header) => ["sku", "vendorsku", "vendorskunumber"].includes(header))) {
    throw new Error("The image file must contain an SKU column")
  }
  return rows.map((row, index) => {
    const vendorSku = readCell(row, ["SKU", "Vendor SKU", "Vendor SKU Number"])
    const imageUrls = [
      readCell(row, ["Primary Image URL", "Primary Image"]),
      ...Array.from({ length: 5 }, (_, imageIndex) =>
        readCell(row, [
          `Gallery Image ${imageIndex + 1}`,
          `Gallery Image ${imageIndex + 1} URL`,
        ]),
      ),
    ].filter(Boolean)

    if (!vendorSku) {
      throw new Error(`Image row ${index + 2}: SKU is required`)
    }
    if (imageUrls.length === 0) {
      throw new Error(`Image row ${index + 2}: provide at least one image URL`)
    }
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

    return { rowNumber: index + 2, vendorSku, imageUrls }
  })
}

const parseProductRows = async (
  file: File,
  imageRows: SupplierBulkImageRow[],
): Promise<SupplierBulkProductRow[]> => {
  const rows = await parseSpreadsheet(file)
  const headers = Object.keys(rows[0]).map(normalizeHeader)
  if (
    !headers.includes("platformpartnumbersku") ||
    !headers.some((header) =>
      ["vendorskunumber", "vendorsku", "sku"].includes(header),
    ) ||
    !headers.some((header) =>
      ["oempartnumber", "oemnumber", "oem"].includes(header),
    )
  ) {
    throw new Error(
      "The product file must contain Platform Part number (SKU), Vendor SKU number, and OEM Part Number columns",
    )
  }
  const imagesBySku = new Map(
    imageRows.map((row) => [row.vendorSku.trim().toUpperCase(), row.imageUrls]),
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
      mpn: null,
      brand: null,
      price: 0,
      stock: 0,
      oemSupersessionNumbers: splitValues(
        readCell(row, ["OEM Supersession Numbers", "Supersession Numbers"]),
      ),
      competitorPartNumber: readCell(row, ["Competitor Part Number"]),
      competitorBrandName: readCell(row, ["Competitor Brand Name"]),
      hsCode: readCell(row, ["HS Code", "Harmonized System Code"]),
      imageUrls: imagesBySku.get(vendorSku.trim().toUpperCase()) ?? [],
      rawUploadData,
    }
  })
}

const getUploadedFile = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : null
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const formData = await request.formData()
    const mode = String(formData.get("mode") ?? "products")
    const imageFile = getUploadedFile(formData, "imageFile")

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

    const productFile = getUploadedFile(formData, "productFile")
    if (!productFile) {
      return NextResponse.json(
        { ok: false, message: "Select a product CSV or Excel file" },
        { status: 400 },
      )
    }

    const imageRows = imageFile ? await parseImageRows(imageFile) : []
    const productRows = await parseProductRows(productFile, imageRows)
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
