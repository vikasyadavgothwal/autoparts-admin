import { db } from "@/lib/database/prisma"
import {
  FleetVehicleStatus,
  Prisma,
  RfqBidStatus,
  RfqSource,
  RfqStatus,
} from "@/lib/generated/prisma/client"
import { getUserAddressForCheckout } from "@/services/user-addresses/user-address-service"
import { getUserVehicleForRfq } from "@/services/user-vehicles/user-vehicle-service"
import {
  activeAdminRecipientIds,
  activeSupplierRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service"
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

const allowedRfqBidPartTypes = ["New", "Used", "Refurbished", "Remanufactured", "Salvage"] as const

const rfqBidPartType = (value: unknown) => {
  const normalized = text(value)
  const match = allowedRfqBidPartTypes.find(
    (partType) => partType.toLowerCase() === normalized.toLowerCase(),
  )
  if (!match) {
    throw new Error(`Part type must be one of: ${allowedRfqBidPartTypes.join(", ")}`)
  }
  return match
}

const requesterLabel = (source: RfqSource) =>
  source === RfqSource.fleet ? "Fleet" : "Customer"

async function notifyRfqCreated(rfq: {
  id: string
  publicId: string
  projectName: string
  requesterId: string | null
  source: RfqSource
}) {
  const [supplierIds, adminIds] = await Promise.all([
    activeSupplierRecipientIds(),
    activeAdminRecipientIds(),
  ])
  const notifications: CreateNotificationInput[] = [
    ...supplierIds.map((supplierId) => ({
      recipientUserId: supplierId,
      actorUserId: rfq.requesterId,
      type: "rfq.created",
      title: "New RFQ available",
      body: `${requesterLabel(rfq.source)} RFQ ${rfq.publicId} is open for supplier quotes.`,
      linkUrl: "/rfq-inbox",
      entityType: "rfq",
      entityId: rfq.id,
    })),
    ...adminIds.map((adminId) => ({
      recipientAdminId: adminId,
      actorUserId: rfq.requesterId,
      type: "rfq.created",
      title: "New RFQ submitted",
      body: `${requesterLabel(rfq.source)} RFQ ${rfq.publicId} was submitted.`,
      linkUrl: "/rfqs",
      entityType: "rfq",
      entityId: rfq.id,
    })),
  ]

  await createNotificationsSafely(notifications)
}

async function notifyRfqBidSubmitted(input: {
  rfqId: string
  rfqPublicId: string
  requesterId: string | null
  supplierId: string
  source: RfqSource
  isUpdate: boolean
}) {
  const adminIds = await activeAdminRecipientIds()
  const title = input.isUpdate ? "RFQ quote updated" : "New RFQ quote received"
  const notifications: CreateNotificationInput[] = []

  if (input.requesterId) {
    notifications.push({
      recipientUserId: input.requesterId,
      actorUserId: input.supplierId,
      type: input.isUpdate ? "rfq.bid.updated" : "rfq.bid.created",
      title,
      body: `A supplier ${input.isUpdate ? "updated a quote" : "submitted a quote"} for RFQ ${input.rfqPublicId}.`,
      linkUrl: "/rfqs",
      entityType: "rfq",
      entityId: input.rfqId,
    })
  }

  notifications.push(
    ...adminIds.map((adminId) => ({
      recipientAdminId: adminId,
      actorUserId: input.supplierId,
      type: input.isUpdate ? "rfq.bid.updated" : "rfq.bid.created",
      title,
      body: `Supplier quote activity on ${requesterLabel(input.source)} RFQ ${input.rfqPublicId}.`,
      linkUrl: "/rfqs",
      entityType: "rfq",
      entityId: input.rfqId,
    })),
  )

  await createNotificationsSafely(notifications)
}

async function notifyRfqBidAccepted(input: {
  rfqId: string
  rfqPublicId: string
  requesterId: string
  source: RfqSource
  orderId: string
  orderPublicId: string
  acceptedSupplierId: string
  rejectedSupplierIds: string[]
}) {
  const adminIds = await activeAdminRecipientIds()
  const notifications: CreateNotificationInput[] = [
    {
      recipientUserId: input.requesterId,
      type: "rfq.bid.accepted",
      title: "RFQ order created",
      body: `RFQ ${input.rfqPublicId} was converted into order ${input.orderPublicId}.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: input.orderId,
    },
    {
      recipientUserId: input.acceptedSupplierId,
      actorUserId: input.requesterId,
      type: "rfq.bid.accepted",
      title: "Your RFQ quote was accepted",
      body: `${requesterLabel(input.source)} accepted your quote for RFQ ${input.rfqPublicId}.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: input.orderId,
    },
    ...input.rejectedSupplierIds.map((supplierId) => ({
      recipientUserId: supplierId,
      actorUserId: input.requesterId,
      type: "rfq.bid.rejected",
      title: "RFQ quote not selected",
      body: `Another quote was selected for RFQ ${input.rfqPublicId}.`,
      linkUrl: "/offers",
      entityType: "rfq",
      entityId: input.rfqId,
    })),
    ...adminIds.map((adminId) => ({
      recipientAdminId: adminId,
      actorUserId: input.requesterId,
      type: "rfq.bid.accepted",
      title: "RFQ quote accepted",
      body: `RFQ ${input.rfqPublicId} created order ${input.orderPublicId}.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: input.orderId,
    })),
  ]

  await createNotificationsSafely(notifications)
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
  let userVehicle = null
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
  if (source === RfqSource.user && input.userVehicleId) {
    if (!requesterId) throw new Error("User authentication is required")
    userVehicle = await getUserVehicleForRfq(requesterId, input.userVehicleId)
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
  const vehicleVin =
    fleetVehicle?.vin ?? userVehicle?.vin ?? (text(vehicle.vin).toUpperCase() || null)
  if (vehicleVin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vehicleVin)) {
    throw new Error("VIN must contain exactly 17 valid characters")
  }
  const vehicleYear =
    fleetVehicle?.year ??
    userVehicle?.year ??
    (vehicle.year ? wholeNumber(vehicle.year, "Vehicle year", 1886) : null)
  if (vehicleYear && vehicleYear > new Date().getFullYear() + 1) {
    throw new Error("Vehicle year cannot be in the future")
  }
  const vehicleMake = fleetVehicle?.make ?? userVehicle?.make ?? (text(vehicle.make) || null)
  const vehicleModel = fleetVehicle?.model ?? userVehicle?.model ?? (text(vehicle.model) || null)
  if (source === RfqSource.user && (!vehicleYear || !vehicleMake || !vehicleModel)) {
    throw new Error("Vehicle year, make, and model are required")
  }

  const rfq = await db.rfq.create({
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

  await notifyRfqCreated(rfq)
  return rfq
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
              select: { id: true, supplierPublicId: true, companyName: true, firstName: true, lastName: true, email: true },
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

export async function listUserRfqs(
  userId: string,
  page: number,
  pageSize: number,
  search = "",
) {
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(50, Math.max(1, pageSize))
  const query = search.trim()
  const where: Prisma.RfqWhereInput = {
    requesterId: userId,
    source: RfqSource.user,
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
        bids: {
          include: {
            supplier: {
              select: { id: true, supplierPublicId: true, companyName: true, firstName: true, lastName: true, email: true },
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
          select: { id: true, supplierPublicId: true, companyName: true, firstName: true, lastName: true, email: true },
        },
        bids: {
          include: {
            supplier: {
              select: { id: true, supplierPublicId: true, companyName: true, firstName: true, lastName: true, email: true },
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
  input: {
    totalAmount?: unknown
    deliveryDays?: unknown
    partType?: unknown
    validUntil?: unknown
    notes?: unknown
  },
) {
  const rfq = await db.rfq.findFirst({
    where: { id: rfqId, status: RfqStatus.open },
    select: {
      id: true,
      publicId: true,
      requesterId: true,
      responseDeadline: true,
      source: true,
    },
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

  const existingBid = await db.rfqBid.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    select: { id: true },
  })

  const bid = await db.rfqBid.upsert({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    create: {
      rfqId,
      supplierId,
      totalAmount: requiredMoneyToCents(input.totalAmount, "Total quote"),
      deliveryDays: wholeNumber(input.deliveryDays, "Delivery days", 1),
      partType: rfqBidPartType(input.partType),
      validUntil,
      notes: text(input.notes) || null,
    },
    update: {
      totalAmount: requiredMoneyToCents(input.totalAmount, "Total quote"),
      deliveryDays: wholeNumber(input.deliveryDays, "Delivery days", 1),
      partType: rfqBidPartType(input.partType),
      validUntil,
      notes: text(input.notes) || null,
      status: RfqBidStatus.submitted,
    },
  })

  await notifyRfqBidSubmitted({
    rfqId: rfq.id,
    rfqPublicId: rfq.publicId,
    requesterId: rfq.requesterId,
    supplierId,
    source: rfq.source,
    isUpdate: Boolean(existingBid),
  })

  return { ...bid, totalAmount: bid.totalAmount / 100 }
}

export async function acceptRfqBid(
  requesterId: string,
  rfqId: string,
  bidId: string,
  source: RfqSource = RfqSource.fleet,
  addressId?: string,
) {
  const deliveryAddress = addressId
    ? await getUserAddressForCheckout(requesterId, addressId)
    : null
  if (!deliveryAddress) {
    throw new Error("Select a delivery address before creating an order")
  }

  const result = await db.$transaction(async (transaction) => {
    const rfq = await transaction.rfq.findFirst({
      where: { id: rfqId, requesterId, source },
      include: { order: true, parts: true },
    })
    if (!rfq) throw new Error("RFQ not found")
    if (rfq.order) {
      if (rfq.order.bidId === bidId) {
        return {
          order: { ...rfq.order, totalAmount: rfq.order.totalAmount / 100 },
          notificationContext: null,
        }
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

    const submittedBids = await transaction.rfqBid.findMany({
      where: { rfqId, status: RfqBidStatus.submitted },
      select: { id: true, supplierId: true },
    })

    const closed = await transaction.rfq.updateMany({
      where: { id: rfqId, requesterId, status: RfqStatus.open },
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
        buyerId: requesterId,
        supplierId: bid.supplierId,
        deliveryAddressId: deliveryAddress?.id,
        deliveryRecipientName: deliveryAddress?.recipientName,
        deliveryPhone: deliveryAddress?.phone,
        deliveryAddressLine1: deliveryAddress?.addressLine1,
        deliveryAddressLine2: deliveryAddress?.addressLine2,
        deliveryLandmark: deliveryAddress?.landmark,
        deliveryCity: deliveryAddress?.city,
        deliveryState: deliveryAddress?.state,
        deliveryPostalCode: deliveryAddress?.postalCode,
        deliveryCountry: deliveryAddress?.country,
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

    return {
      order: { ...order, totalAmount: order.totalAmount / 100 },
      notificationContext: {
        rfqId: rfq.id,
        rfqPublicId: rfq.publicId,
        requesterId,
        source,
        orderId: order.id,
        orderPublicId: order.publicId,
        acceptedSupplierId: bid.supplierId,
        rejectedSupplierIds: submittedBids
          .filter((submittedBid) => submittedBid.id !== bidId)
          .map((submittedBid) => submittedBid.supplierId),
      },
    }
  })

  if (result.notificationContext) {
    await notifyRfqBidAccepted(result.notificationContext)
  }
  return result.order
}
