import { db } from "@/lib/database/prisma"
import {
  FleetVehicleStatus,
  Prisma,
  RfqBidStatus,
  RfqSource,
  RfqStatus,
} from "@/lib/generated/prisma/client"
import type {
  CreateRfqInput,
  FleetVehicleInput,
  RfqAttachment,
} from "@/types/rfq/rfq"

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const requiredText = (value: unknown, label: string) => {
  const normalized = text(value)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

const wholeNumber = (value: unknown, label: string, min = 0) => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be a whole number of at least ${min}`)
  }
  return parsed
}

const moneyToCents = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Target price must be a non-negative number")
  }
  return Math.round(parsed * 100)
}

const requiredMoneyToCents = (value: unknown, label: string) => {
  const cents = moneyToCents(value)
  if (cents === null || cents <= 0) throw new Error(`${label} must be greater than zero`)
  return cents
}

const mapRfqMoney = <T extends {
  parts: Array<{ targetPrice: number | null }>
  bids?: Array<{ totalAmount: number }>
  order?: { totalAmount: number } | null
}>(rfq: T) => ({
  ...rfq,
  parts: rfq.parts.map((part) => ({
    ...part,
    targetPrice: part.targetPrice === null ? null : part.targetPrice / 100,
  })),
  ...(rfq.bids
    ? { bids: rfq.bids.map((bid) => ({ ...bid, totalAmount: bid.totalAmount / 100 })) }
    : {}),
  ...(rfq.order
    ? { order: { ...rfq.order, totalAmount: rfq.order.totalAmount / 100 } }
    : {}),
})

export async function listFleetVehicles(
  fleetId: string,
  page: number,
  pageSize: number,
) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(50, Math.max(1, pageSize))
  const [vehicles, total] = await Promise.all([
    db.fleetVehicle.findMany({
      where: { fleetId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    db.fleetVehicle.count({ where: { fleetId } }),
  ])
  return {
    vehicles,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  }
}

export async function createFleetVehicle(
  fleetId: string,
  input: FleetVehicleInput,
) {
  const vin = requiredText(input.vin, "VIN").toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error("VIN must contain exactly 17 valid characters")
  }
  const status = Object.values(FleetVehicleStatus).includes(
    input.status as FleetVehicleStatus,
  )
    ? (input.status as FleetVehicleStatus)
    : FleetVehicleStatus.active

  return db.$transaction(async (transaction) => {
    if (input.isPrimary) {
      await transaction.fleetVehicle.updateMany({
        where: { fleetId, isPrimary: true },
        data: { isPrimary: false },
      })
    }
    return transaction.fleetVehicle.create({
      data: {
        fleetId,
        vehicleName: requiredText(input.vehicleName, "Vehicle name"),
        vin,
        mileage: wholeNumber(input.mileage, "Mileage"),
        driver: text(input.driver) || null,
        status,
        year: wholeNumber(input.year, "Year", 1900),
        make: requiredText(input.make, "Make"),
        model: requiredText(input.model, "Model"),
        trim: text(input.trim) || null,
        isPrimary: Boolean(input.isPrimary),
      },
    })
  })
}

export async function updateFleetVehicle(
  fleetId: string,
  vehicleId: string,
  input: FleetVehicleInput,
) {
  const existing = await db.fleetVehicle.findFirst({
    where: { id: vehicleId, fleetId },
  })
  if (!existing) throw new Error("Vehicle not found")

  const vin = requiredText(input.vin, "VIN").toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error("VIN must contain exactly 17 valid characters")
  }
  const status = Object.values(FleetVehicleStatus).includes(
    input.status as FleetVehicleStatus,
  )
    ? (input.status as FleetVehicleStatus)
    : FleetVehicleStatus.active

  return db.$transaction(async (transaction) => {
    if (input.isPrimary) {
      await transaction.fleetVehicle.updateMany({
        where: { fleetId, isPrimary: true, id: { not: vehicleId } },
        data: { isPrimary: false },
      })
    }
    return transaction.fleetVehicle.update({
      where: { id: vehicleId },
      data: {
        vehicleName: requiredText(input.vehicleName, "Vehicle name"),
        vin,
        mileage: wholeNumber(input.mileage, "Mileage"),
        driver: text(input.driver) || null,
        status,
        year: wholeNumber(input.year, "Year", 1900),
        make: requiredText(input.make, "Make"),
        model: requiredText(input.model, "Model"),
        trim: text(input.trim) || null,
        isPrimary: Boolean(input.isPrimary),
      },
    })
  })
}

export async function deleteFleetVehicle(fleetId: string, vehicleId: string) {
  const vehicle = await db.fleetVehicle.findFirst({
    where: { id: vehicleId, fleetId },
    select: { id: true },
  })
  if (!vehicle) throw new Error("Vehicle not found")
  await db.fleetVehicle.delete({ where: { id: vehicle.id } })
  return { id: vehicle.id }
}

export async function createRfq(
  input: CreateRfqInput,
  requesterId: string | null,
  attachment: RfqAttachment | null,
) {
  const source = input.source === "fleet" ? RfqSource.fleet : RfqSource.user
  let fleetVehicle = null
  const requester = requesterId
    ? await db.user.findUnique({ where: { id: requesterId } })
    : null
  if (source === RfqSource.fleet) {
    if (!requesterId) throw new Error("Fleet authentication is required")
    const vehicleId = requiredText(input.fleetVehicleId, "Fleet vehicle")
    fleetVehicle = await db.fleetVehicle.findFirst({
      where: { id: vehicleId, fleetId: requesterId },
    })
    if (!fleetVehicle) throw new Error("Select a vehicle owned by this fleet")
  }

  if (!Array.isArray(input.parts) || input.parts.length === 0) {
    throw new Error("Add at least one part")
  }
  if (input.parts.length > 100) throw new Error("An RFQ can contain at most 100 parts")

  const deadline = new Date(input.responseDeadline)
  if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
    throw new Error("Response deadline must be in the future")
  }
  const vehicle = input.vehicle ?? {}
  const email = requiredText(
    source === RfqSource.fleet ? requester?.email || input.email : input.email,
    "Email",
  ).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address")
  }
  const phone = requiredText(
    source === RfqSource.fleet ? requester?.phone || input.phone : input.phone,
    "Phone",
  )
  if (source === RfqSource.user && !/^[+\d][\d\s()-]{6,20}$/.test(phone)) {
    throw new Error("Enter a valid phone number")
  }
  const vehicleVin = fleetVehicle?.vin ?? (text(vehicle.vin).toUpperCase() || null)
  if (vehicleVin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vehicleVin)) {
    throw new Error("VIN must contain exactly 17 valid characters")
  }
  const vehicleYear =
    fleetVehicle?.year ??
    (vehicle.year ? wholeNumber(vehicle.year, "Vehicle year", 1886) : null)
  if (vehicleYear && vehicleYear > new Date().getFullYear() + 1) {
    throw new Error("Vehicle year cannot be in the future")
  }
  const vehicleMake = fleetVehicle?.make ?? (text(vehicle.make) || null)
  const vehicleModel = fleetVehicle?.model ?? (text(vehicle.model) || null)
  if (source === RfqSource.user && (!vehicleYear || !vehicleMake || !vehicleModel)) {
    throw new Error("Vehicle year, make, and model are required")
  }

  return db.rfq.create({
    data: {
      requesterId,
      fleetVehicleId: fleetVehicle?.id,
      source,
      status: RfqStatus.open,
      projectName: requiredText(input.projectName, "Project name"),
      description: text(input.description) || null,
      responseDeadline: deadline,
      deliveryRequirement: requiredText(input.deliveryRequirement, "Delivery requirement"),
      paymentTerms: requiredText(input.paymentTerms, "Payment terms"),
      companyName: requiredText(
        source === RfqSource.fleet
          ? requester?.companyName || input.companyName
          : input.companyName,
        "Company name",
      ),
      contactName: requiredText(
        source === RfqSource.fleet
          ? [requester?.firstName, requester?.lastName].filter(Boolean).join(" ") || input.contactName
          : input.contactName,
        "Contact name",
      ),
      email,
      phone,
      vehicleVin,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleTrim: fleetVehicle?.trim ?? (text(vehicle.trim) || null),
      attachmentKey: attachment?.key,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentMimeType: attachment?.mimeType,
      attachmentSize: attachment?.size,
      parts: {
        create: input.parts.map((part) => ({
          partName: requiredText(part.partName, "Part name"),
          partNumber: text(part.partNumber) || null,
          quantity: wholeNumber(part.quantity, "Quantity", 1),
          targetPrice: moneyToCents(part.targetPrice),
          notes: text(part.notes) || null,
        })),
      },
    },
    include: { parts: true, fleetVehicle: true },
  })
}

export async function listSupplierRfqs(
  supplierId: string,
  page: number,
  pageSize: number,
  search = "",
) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(50, Math.max(1, pageSize))
  const query = search.trim()
  const where: Prisma.RfqWhereInput = {
    status: RfqStatus.open,
    ...(query ? {
      OR: [
        { publicId: { contains: query, mode: "insensitive" } },
        { projectName: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { vehicleVin: { contains: query, mode: "insensitive" } },
        { vehicleMake: { contains: query, mode: "insensitive" } },
        { vehicleModel: { contains: query, mode: "insensitive" } },
        { parts: { some: { partName: { contains: query, mode: "insensitive" } } } },
        { parts: { some: { partNumber: { contains: query, mode: "insensitive" } } } },
      ],
    } : {}),
  }
  const [rfqs, total] = await Promise.all([
    db.rfq.findMany({
      where,
      include: {
        parts: true,
        fleetVehicle: true,
        bids: { where: { supplierId }, orderBy: { updatedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    db.rfq.count({ where }),
  ])
  return {
    rfqs: rfqs.map(mapRfqMoney),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  }
}

export async function listFleetRfqs(
  fleetId: string,
  page: number,
  pageSize: number,
  search = "",
) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(50, Math.max(1, pageSize))
  const query = search.trim()
  const where: Prisma.RfqWhereInput = {
    requesterId: fleetId,
    source: RfqSource.fleet,
    ...(query ? {
      OR: [
        { publicId: { contains: query, mode: "insensitive" } },
        { projectName: { contains: query, mode: "insensitive" } },
        { vehicleVin: { contains: query, mode: "insensitive" } },
        { vehicleMake: { contains: query, mode: "insensitive" } },
        { vehicleModel: { contains: query, mode: "insensitive" } },
        { parts: { some: { partName: { contains: query, mode: "insensitive" } } } },
        { parts: { some: { partNumber: { contains: query, mode: "insensitive" } } } },
      ],
    } : {}),
  }
  const [rfqs, total] = await Promise.all([
    db.rfq.findMany({
      where,
      include: {
        parts: true,
        fleetVehicle: true,
        bids: {
          include: {
            supplier: {
              select: { id: true, companyName: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { totalAmount: "asc" },
        },
        order: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    db.rfq.count({ where }),
  ])
  return {
    rfqs: rfqs.map(mapRfqMoney),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  }
}

export async function listAdminRfqs(page = 1, pageSize = 100) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(200, Math.max(1, pageSize))
  const [rfqs, total] = await Promise.all([
    db.rfq.findMany({
      include: {
        parts: true,
        fleetVehicle: true,
        requester: {
          select: { id: true, companyName: true, firstName: true, lastName: true, email: true },
        },
        bids: {
          include: {
            supplier: {
              select: { id: true, companyName: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { totalAmount: "asc" },
        },
        order: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    db.rfq.count(),
  ])
  return { rfqs: rfqs.map(mapRfqMoney), total }
}

export async function submitRfqBid(
  supplierId: string,
  rfqId: string,
  input: { totalAmount?: unknown; deliveryDays?: unknown; validUntil?: unknown; notes?: unknown },
) {
  const rfq = await db.rfq.findFirst({
    where: { id: rfqId, status: RfqStatus.open },
    select: { id: true, responseDeadline: true },
  })
  if (!rfq) throw new Error("This RFQ is not open for quotes")
  if (rfq.responseDeadline <= new Date()) throw new Error("The RFQ response deadline has passed")

  const validUntilText = text(input.validUntil)
  const validUntil = validUntilText
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(validUntilText)
        ? `${validUntilText}T23:59:59.999Z`
        : validUntilText)
    : null
  if (validUntil && (Number.isNaN(validUntil.getTime()) || validUntil <= new Date())) {
    throw new Error("Quote validity date must be in the future")
  }

  const bid = await db.rfqBid.upsert({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    create: {
      rfqId,
      supplierId,
      totalAmount: requiredMoneyToCents(input.totalAmount, "Total quote"),
      deliveryDays: wholeNumber(input.deliveryDays, "Delivery days", 1),
      validUntil,
      notes: text(input.notes) || null,
    },
    update: {
      totalAmount: requiredMoneyToCents(input.totalAmount, "Total quote"),
      deliveryDays: wholeNumber(input.deliveryDays, "Delivery days", 1),
      validUntil,
      notes: text(input.notes) || null,
      status: RfqBidStatus.submitted,
    },
  })
  return { ...bid, totalAmount: bid.totalAmount / 100 }
}

export async function acceptRfqBid(fleetId: string, rfqId: string, bidId: string) {
  return db.$transaction(async (transaction) => {
    const rfq = await transaction.rfq.findFirst({
      where: { id: rfqId, requesterId: fleetId, source: RfqSource.fleet },
      include: { order: true, parts: true },
    })
    if (!rfq) throw new Error("RFQ not found")
    if (rfq.order) {
      if (rfq.order.bidId === bidId) {
        return { ...rfq.order, totalAmount: rfq.order.totalAmount / 100 }
      }
      throw new Error("A quote has already been accepted for this RFQ")
    }
    if (rfq.status !== RfqStatus.open) throw new Error("This RFQ is no longer open")

    const now = new Date()
    if (rfq.responseDeadline <= now) {
      throw new Error("The RFQ response deadline has passed")
    }

    const bid = await transaction.rfqBid.findFirst({
      where: { id: bidId, rfqId, status: RfqBidStatus.submitted },
    })
    if (!bid) throw new Error("Quote not found or no longer available")
    if (bid.validUntil) {
      const quoteExpiry = new Date(bid.validUntil)
      // Older date-only quotes were stored at midnight; treat them as valid through that day.
      if (
        quoteExpiry.getUTCHours() === 0 &&
        quoteExpiry.getUTCMinutes() === 0 &&
        quoteExpiry.getUTCSeconds() === 0 &&
        quoteExpiry.getUTCMilliseconds() === 0
      ) {
        quoteExpiry.setUTCHours(23, 59, 59, 999)
      }
      if (quoteExpiry <= now) throw new Error("This supplier quote has expired")
    }

    const closed = await transaction.rfq.updateMany({
      where: { id: rfqId, requesterId: fleetId, status: RfqStatus.open },
      data: { status: RfqStatus.closed },
    })
    if (closed.count !== 1) throw new Error("This RFQ was updated by another request")

    await transaction.rfqBid.updateMany({
      where: { rfqId, id: { not: bidId }, status: RfqBidStatus.submitted },
      data: { status: RfqBidStatus.rejected },
    })
    await transaction.rfqBid.update({
      where: { id: bidId },
      data: { status: RfqBidStatus.accepted },
    })
    const order = await transaction.order.create({
      data: {
        rfqId,
        bidId,
        buyerId: fleetId,
        supplierId: bid.supplierId,
        totalAmount: bid.totalAmount,
        items: {
          create: rfq.parts.map((part) => ({
            partName: part.partName,
            partNumber: part.partNumber,
            quantity: part.quantity,
          })),
        },
      },
    })
    return { ...order, totalAmount: order.totalAmount / 100 }
  })
}
