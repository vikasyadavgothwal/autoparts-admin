"use client"

import { useCallback, useState } from "react"
import * as XLSX from "xlsx"

import type {
  ParsedVehicleSheet,
  VehicleBulkRow,
} from "@/types/admin-dashboard/vehicles/vehicles"

const normalizeHeader = (value: string): string =>
  value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, "")

const DUMMY_VEHICLE_ROWS = [
  { brand: "Toyota", carName: "Corolla", variant: "GLI", modelYear: 2024 },
  { brand: "Toyota", carName: "Corolla", variant: "XLI", modelYear: 2023 },
  { brand: "Toyota", carName: "Camry", variant: "", modelYear: 2024 },
  { brand: "Honda", carName: "Civic", variant: "RS", modelYear: 2025 },
  { brand: "Honda", carName: "City", variant: "", modelYear: null },
] satisfies VehicleBulkRow[]

const getCellValue = (
  row: Record<string, unknown>,
  acceptedHeaders: readonly string[],
): string => {
  for (const [header, value] of Object.entries(row)) {
    if (acceptedHeaders.includes(normalizeHeader(header))) {
      return typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : ""
    }
  }

  return ""
}

const createDummySheet = () => XLSX.utils.json_to_sheet(DUMMY_VEHICLE_ROWS)

const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function useVehicleSheet() {
  const [isParsing, setIsParsing] = useState(false)

  const parseFile = useCallback(async (file: File): Promise<ParsedVehicleSheet> => {
    setIsParsing(true)

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        return { rows: [], errors: ["The workbook does not contain a sheet"] }
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      })
      const rows: VehicleBulkRow[] = []
      const errors: string[] = []

      rawRows.forEach((row, index) => {
        const brand = getCellValue(row, ["brand", "brandname"])
        const carName = getCellValue(row, ["car", "carname", "vehicle", "model"])
        const variant = getCellValue(row, ["variant", "varient", "trim"])
        const modelYearValue = getCellValue(row, [
          "modelyear",
          "year",
          "yearmodel",
        ])

        if (!brand && !carName && !variant && !modelYearValue) {
          return
        }

        if (!brand || !carName) {
          errors.push(`Row ${index + 2}: brand and carName are required`)
          return
        }

        const modelYear = modelYearValue ? Number(modelYearValue) : null
        if (modelYearValue && !Number.isInteger(modelYear)) {
          errors.push(`Row ${index + 2}: modelYear must be a whole number`)
          return
        }

        rows.push({
          brand,
          carName,
          variant: variant || null,
          modelYear,
        })
      })

      return { rows, errors }
    } catch {
      return { rows: [], errors: ["Unable to read this spreadsheet"] }
    } finally {
      setIsParsing(false)
    }
  }, [])

  const downloadDummyCsv = useCallback(() => {
    const csv = XLSX.utils.sheet_to_csv(createDummySheet())
    downloadTextFile(csv, "vehicle-import-dummy.csv", "text/csv;charset=utf-8")
  }, [])



  return {
    isParsing,
    parseFile,
    downloadDummyCsv,
  }
}
