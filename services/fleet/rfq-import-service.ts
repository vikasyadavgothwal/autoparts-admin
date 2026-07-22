import * as XLSX from "xlsx"

import { db } from "@/lib/database/prisma"
import { fetchVinSearchResult, getVinSearchApiBaseUrl, normalizeVinSearchResult } from "@/lib/vin-search"
import type { ImportedRfqWorkbook } from "@/types/rfq/rfq-import"

const maxRows = 20
const requiredHeaders = ["vinno", "quantity", "price", "partnumber", "partname"] as const
const normalizeHeader = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
const cellText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ")
const titleCase = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase())

const findTextValue = (value: unknown, keys: Set<string>): string => {
  if (!value || typeof value !== "object") return ""
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTextValue(item, keys)
      if (found) return found
    }
    return ""
  }
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key.toLowerCase()) && (typeof item === "string" || typeof item === "number")) {
      const found = cellText(item)
      if (found) return found
    }
  }
  for (const item of Object.values(value)) {
    const found = findTextValue(item, keys)
    if (found) return found
  }
  return ""
}

type ParsedRfqWorkbook = Omit<ImportedRfqWorkbook, "vehicles">

export function parseRfqWorkbook(buffer: Buffer): ParsedRfqWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("The uploaded file does not contain a worksheet")
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" })
  const [headerRow, ...dataRows] = rows
  if (!headerRow) throw new Error("The uploaded file is empty")
  const indexes = new Map(headerRow.map((header, index) => [normalizeHeader(header), index]))
  const missing = requiredHeaders.filter((header) => !indexes.has(header))
  if (missing.length) throw new Error("Use exactly these columns: VIN No, Quantity, Price, Part Number, Part Name")

  const populatedRows = dataRows.filter((row) => row.some((cell) => cellText(cell)))
  if (!populatedRows.length) throw new Error("Add at least one part row")
  if (populatedRows.length > maxRows) throw new Error(`An RFQ can include up to ${maxRows} parts`)

  const vins = new Set<string>()
  const parts = populatedRows.map((row, index) => {
    const rowNumber = index + 2
    const value = (header: (typeof requiredHeaders)[number]) => cellText(row[indexes.get(header)!])
    const vin = value("vinno").toUpperCase()
    const partName = value("partname")
    const partNumber = value("partnumber")
    const quantity = Number(value("quantity"))
    const price = value("price").replace(/[^\d.]/g, "")
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error(`Row ${rowNumber}: VIN must contain 17 valid characters`)
    if (!partName) throw new Error(`Row ${rowNumber}: Part Name is required`)
    if (!partNumber) throw new Error(`Row ${rowNumber}: Part Number is required`)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error(`Row ${rowNumber}: Quantity must be between 1 and 999`)
    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) > 999999.99) throw new Error(`Row ${rowNumber}: Price must be a valid AED amount`)
    vins.add(vin)
    return { vin, partName, partNumber, quantity, targetPrice: price }
  })
  const importedVins = Array.from(vins)
  return { vin: importedVins[0], vins: importedVins, parts }
}

export async function importRfqWorkbook(buffer: Buffer): Promise<ImportedRfqWorkbook> {
  const parsed = parseRfqWorkbook(buffer)
  const vehicles = await resolveVehicleVins(parsed.vins)
  return { ...parsed, vehicles }
}

export async function resolveVehicleVins(vins: string[]) {
  const [cached, userVehicles, fleetVehicles] = await Promise.all([
    db.vinLookupCache.findMany({ where: { vin: { in: vins } } }),
    db.userVehicle.findMany({ where: { vin: { in: vins } }, orderBy: { updatedAt: "desc" } }),
    db.fleetVehicle.findMany({ where: { vin: { in: vins } }, orderBy: { updatedAt: "desc" } }),
  ])
  const hasRealModel = (vehicle: { make: string; model: string }) =>
    vehicle.model.trim().toLowerCase() !== vehicle.make.trim().toLowerCase()
  const resolved = new Map(
    cached.filter(hasRealModel).map((vehicle) => [vehicle.vin, vehicle]),
  )

  for (const vin of vins) {
    if (resolved.has(vin)) continue
    const saved = fleetVehicles.find((vehicle) => vehicle.vin === vin) ?? userVehicles.find((vehicle) => vehicle.vin === vin)
    if (!saved || !hasRealModel(saved)) continue
    const vehicle = await db.vinLookupCache.upsert({
      where: { vin },
      update: {
        year: saved.year,
        make: saved.make,
        model: saved.model,
        vehicleName: "vehicleName" in saved ? saved.vehicleName : `${saved.year} ${saved.make} ${saved.model}`,
        trim: "trim" in saved ? saved.trim : null,
      },
      create: {
        vin,
        year: saved.year,
        make: saved.make,
        model: saved.model,
        vehicleName: "vehicleName" in saved ? saved.vehicleName : `${saved.year} ${saved.make} ${saved.model}`,
        trim: "trim" in saved ? saved.trim : null,
      },
    })
    resolved.set(vin, vehicle)
  }

  const unresolved: string[] = []
  for (const vin of vins) {
    if (resolved.has(vin)) continue
    const username = process.env.VIN_API_USER?.trim()
    const password = process.env.VIN_API_PASS?.trim()
    if (!username || !password) throw new Error("VIN lookup is temporarily unavailable. Please try again later.")
    try {
      const upstream = await fetchVinSearchResult(vin, undefined, { username, password }, getVinSearchApiBaseUrl())
      const normalized = upstream.ok ? normalizeVinSearchResult(upstream.data) : null
      if (!normalized?.ok) {
        unresolved.push(vin)
        continue
      }
      const year = Number(normalized.data["Model year"])
      const make = titleCase(
        findTextValue(upstream.data, new Set(["factory_en", "brand_en", "make_en"])) || normalized.data["Make name"].trim(),
      )
      const model =
        findTextValue(upstream.data, new Set(["model_en", "model_name_en", "modelname_en", "series_en"])) ||
        findTextValue(upstream.data, new Set(["model", "model_name", "modelname", "car_model", "carmodel"]))
      const trim =
        findTextValue(upstream.data, new Set(["sales_version_en", "trim_en", "variant_en"])) ||
        findTextValue(upstream.data, new Set(["trim", "sales_version", "variant"]))
      const vehicleName = [year, make, model, trim].filter(Boolean).join(" ")
      if (!Number.isInteger(year) || !make || !model || model.toLowerCase() === make.toLowerCase()) {
        unresolved.push(vin)
        continue
      }
      const vehicle = await db.vinLookupCache.upsert({
        where: { vin },
        update: { year, make, model, vehicleName, trim: trim || null, rawData: upstream.data as object },
        create: { vin, year, make, model, vehicleName, trim: trim || null, rawData: upstream.data as object },
      })
      resolved.set(vin, vehicle)
    } catch {
      unresolved.push(vin)
    }
  }

  if (unresolved.length) {
    throw new Error(`We could not find these VINs: ${unresolved.join(", ")}. Remove or correct them, then upload the file again.`)
  }

  return vins.map((vin) => {
    const vehicle = resolved.get(vin)!
    return {
      vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      vehicleName: vehicle.vehicleName || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      trim: vehicle.trim || "",
    }
  })
}
