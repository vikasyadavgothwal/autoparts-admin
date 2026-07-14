import { db } from "@/lib/database/prisma"

const allowedStatuses = ["Active", "In Service", "Inactive"] as const

export type UserVehicleInput = {
  year: number | string
  make: string
  model: string
  vin?: string | null
  mileage?: number | string | null
  status?: string | null
  primary?: boolean
  isPrimary?: boolean
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const requiredText = (value: unknown, label: string) => {
  const normalized = text(value)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

const wholeNumber = (value: unknown, label: string, min = 0) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be a whole number of at least ${min}`)
  }
  return parsed
}

const vehicleStatus = (value: unknown) => {
  const normalized = text(value)
  return allowedStatuses.includes(normalized as (typeof allowedStatuses)[number])
    ? normalized
    : "Active"
}

const vehicleVin = (value: unknown) => {
  const vin = text(value).toUpperCase()
  if (!vin) return null
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error("VIN must contain exactly 17 valid characters")
  }
  return vin
}

const vehicleYear = (value: unknown) => {
  const year = wholeNumber(value, "Vehicle year", 1886)
  if (year > new Date().getFullYear() + 1) {
    throw new Error("Vehicle year cannot be in the future")
  }
  return year
}

const wantsPrimary = (input: UserVehicleInput) =>
  input.isPrimary === true || input.primary === true

const serializeUserVehicle = (vehicle: {
  id: string
  year: number
  make: string
  model: string
  vin: string | null
  mileage: number
  status: string
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  id: vehicle.id,
  year: String(vehicle.year),
  make: vehicle.make,
  model: vehicle.model,
  vin: vehicle.vin ?? "",
  mileage: String(vehicle.mileage),
  status: vehicleStatus(vehicle.status),
  primary: vehicle.isPrimary,
  isPrimary: vehicle.isPrimary,
  createdAt: vehicle.createdAt.toISOString(),
  updatedAt: vehicle.updatedAt.toISOString(),
})

export async function listUserVehicles(
  userId: string,
  page: number,
  pageSize: number,
) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(50, Math.max(1, pageSize))
  const [vehicles, total] = await Promise.all([
    db.userVehicle.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    db.userVehicle.count({ where: { userId } }),
  ])

  return {
    vehicles: vehicles.map(serializeUserVehicle),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  }
}

export async function createUserVehicle(userId: string, input: UserVehicleInput) {
  const makePrimary =
    wantsPrimary(input) ||
    (await db.userVehicle.count({ where: { userId } })) === 0

  const vehicle = await db.$transaction(async (transaction) => {
    if (makePrimary) {
      await transaction.userVehicle.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    return transaction.userVehicle.create({
      data: {
        userId,
        year: vehicleYear(input.year),
        make: requiredText(input.make, "Make"),
        model: requiredText(input.model, "Model"),
        vin: vehicleVin(input.vin),
        mileage: wholeNumber(input.mileage ?? 0, "Mileage"),
        status: vehicleStatus(input.status),
        isPrimary: makePrimary,
      },
    })
  })

  return serializeUserVehicle(vehicle)
}

export async function updateUserVehicle(
  userId: string,
  vehicleId: string,
  input: UserVehicleInput,
) {
  const existing = await db.userVehicle.findFirst({
    where: { id: vehicleId, userId },
    select: { id: true },
  })
  if (!existing) throw new Error("Vehicle not found")

  const makePrimary = wantsPrimary(input)
  const vehicle = await db.$transaction(async (transaction) => {
    if (makePrimary) {
      await transaction.userVehicle.updateMany({
        where: { userId, id: { not: vehicleId }, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    return transaction.userVehicle.update({
      where: { id: vehicleId },
      data: {
        year: vehicleYear(input.year),
        make: requiredText(input.make, "Make"),
        model: requiredText(input.model, "Model"),
        vin: vehicleVin(input.vin),
        mileage: wholeNumber(input.mileage ?? 0, "Mileage"),
        status: vehicleStatus(input.status),
        ...(makePrimary ? { isPrimary: true } : {}),
      },
    })
  })

  return serializeUserVehicle(vehicle)
}

export async function deleteUserVehicle(userId: string, vehicleId: string) {
  const vehicle = await db.userVehicle.findFirst({
    where: { id: vehicleId, userId },
    select: { id: true, isPrimary: true },
  })
  if (!vehicle) throw new Error("Vehicle not found")

  await db.$transaction(async (transaction) => {
    await transaction.userVehicle.delete({ where: { id: vehicle.id } })
    if (vehicle.isPrimary) {
      const nextPrimary = await transaction.userVehicle.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
      if (nextPrimary) {
        await transaction.userVehicle.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        })
      }
    }
  })

  return { id: vehicle.id }
}

export async function getUserVehicleForRfq(userId: string, vehicleId: string) {
  const vehicle = await db.userVehicle.findFirst({
    where: { id: vehicleId, userId },
  })
  if (!vehicle) throw new Error("Select a vehicle owned by this account")
  return vehicle
}
