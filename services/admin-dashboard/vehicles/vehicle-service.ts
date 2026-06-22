import { db } from "@/lib/database/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"
import type {
  PartInput,
  VehicleBulkRow,
  VehicleInput,
  VehiclePageResult,
  VehicleRecord,
  VehicleSearchInput,
} from "@/types/admin-dashboard/vehicles/vehicles"

const MAX_BULK_ROWS = 2_000
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100
const MIN_MODEL_YEAR = 1886
const MAX_MODEL_YEAR = new Date().getFullYear() + 2

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ")
const normalizeKey = (value: string): string => normalizeText(value).toLocaleLowerCase()

const normalizeModelYear = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (!Number.isInteger(value) || value < MIN_MODEL_YEAR || value > MAX_MODEL_YEAR) {
    throw new Error(
      `Model year must be between ${MIN_MODEL_YEAR} and ${MAX_MODEL_YEAR}`,
    )
  }

  return value
}

const normalizeVehicleInput = (input: VehicleInput) => {
  const brand = normalizeText(input.brand ?? "")
  const carName = normalizeText(input.carName ?? "")
  const variant = normalizeText(input.variant ?? "") || null
  const modelYear = normalizeModelYear(input.modelYear)

  if (!brand) {
    throw new Error("Brand is required")
  }

  if (!carName) {
    throw new Error("Car name is required")
  }

  return {
    brand,
    brandKey: normalizeKey(brand),
    carName,
    carNameKey: normalizeKey(carName),
    variant,
    variantKey: variant ? normalizeKey(variant) : "",
    modelYear,
    modelYearKey: modelYear ?? 0,
  }
}

const mapVehicle = (vehicle: {
  id: string
  brand: string
  carName: string
  variant: string | null
  modelYear: number | null
  createdAt: Date
  updatedAt: Date
  _count: { parts: number }
}): VehicleRecord => ({
  id: vehicle.id,
  brand: vehicle.brand,
  carName: vehicle.carName,
  variant: vehicle.variant,
  modelYear: vehicle.modelYear,
  partCount: vehicle._count.parts,
  createdAt: vehicle.createdAt.toISOString(),
  updatedAt: vehicle.updatedAt.toISOString(),
})

export async function getVehicleCatalog(
  input: VehicleSearchInput = {},
): Promise<VehiclePageResult> {
  const query = normalizeText(input.query ?? "").toLocaleLowerCase()
  const requestedPage = Number.isInteger(input.page) && (input.page ?? 0) > 0
    ? input.page ?? 1
    : 1
  const pageSize = Number.isInteger(input.pageSize) && (input.pageSize ?? 0) > 0
    ? Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE
  const searchTerms = query.split(" ").filter(Boolean)
  const where: Prisma.VehicleWhereInput = searchTerms.length
    ? {
        AND: searchTerms.map((term) => {
          const modelYear = /^\d{4}$/.test(term) ? Number(term) : null

          return {
            OR: [
              { brandKey: { contains: term } },
              { carNameKey: { contains: term } },
              { variantKey: { contains: term } },
              ...(modelYear ? [{ modelYear: { equals: modelYear } }] : []),
            ],
          }
        }),
      }
    : {}
  const totalItems = await db.vehicle.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(requestedPage, totalPages)

  const vehicles = await db.vehicle.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [
      { brand: "asc" },
      { carName: "asc" },
      { variant: "asc" },
      { modelYear: "desc" },
    ],
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return {
    vehicles: vehicles.map(mapVehicle),
    query,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  }
}

export async function createVehicle(input: VehicleInput): Promise<VehicleRecord> {
  const data = normalizeVehicleInput(input)

  const vehicle = await db.vehicle.create({
    data,
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return mapVehicle(vehicle)
}

export async function updateVehicle(
  id: string,
  input: VehicleInput,
): Promise<VehicleRecord> {
  if (!id.trim()) {
    throw new Error("Vehicle ID is required")
  }

  const vehicle = await db.vehicle.update({
    where: { id },
    data: normalizeVehicleInput(input),
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return mapVehicle(vehicle)
}

export async function deleteVehicle(id: string): Promise<void> {
  if (!id.trim()) {
    throw new Error("Vehicle ID is required")
  }

  await db.vehicle.delete({ where: { id } })
}

export async function importVehicles(
  rows: VehicleBulkRow[],
): Promise<{ imported: number; skipped: number }> {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("The sheet does not contain any vehicle rows")
  }

  if (rows.length > MAX_BULK_ROWS) {
    throw new Error(`A maximum of ${MAX_BULK_ROWS} rows can be imported at once`)
  }

  const normalizedRows = rows.map(normalizeVehicleInput)
  const uniqueRows = new Map<string, (typeof normalizedRows)[number]>()

  for (const row of normalizedRows) {
    uniqueRows.set(
      `${row.brandKey}\u0000${row.carNameKey}\u0000${row.variantKey}\u0000${row.modelYearKey}`,
      row,
    )
  }

  const operations = Array.from(uniqueRows.values()).map((row) =>
    db.vehicle.upsert({
      where: {
        brandKey_carNameKey_variantKey_modelYearKey: {
          brandKey: row.brandKey,
          carNameKey: row.carNameKey,
          variantKey: row.variantKey,
          modelYearKey: row.modelYearKey,
        },
      },
      create: row,
      update: {
        brand: row.brand,
        carName: row.carName,
        variant: row.variant,
        modelYear: row.modelYear,
      },
    }),
  )

  await db.$transaction(operations)

  return {
    imported: uniqueRows.size,
    skipped: rows.length - uniqueRows.size,
  }
}

export async function createPart(input: PartInput): Promise<void> {
  const vehicleId = input.vehicleId.trim()
  const name = normalizeText(input.name ?? "")
  const partNumber = normalizeText(input.partNumber ?? "") || null

  if (!vehicleId || !name) {
    throw new Error("Vehicle and part name are required")
  }

  await db.part.create({
    data: {
      vehicleId,
      name,
      partNumber,
    },
  })
}
