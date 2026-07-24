import { createHash, randomInt, randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { sendSmtpMail } from "@/lib/email/smtp"
import { OrderStatus, Prisma } from "@/lib/generated/prisma/client"
import {
  activeAdminRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service"
import {
  calculateGarageBookingAdvanceAmount,
  getGarageBookingAdvanceSetting,
} from "@/services/platform-settings/platform-settings-service"
import type {
  GarageBookingInput,
  GarageOfflineBookingInput,
  GarageBookingRecord,
  GarageBookingStatus,
  UserGarageBookingRecord,
} from "@/types/garage/bookings"

type GarageBookingRow = {
  id: string
  publicId: string
  garageId: string
  customerId: string | null
  serviceId: string | null
  serviceName: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  vehicleYear: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleVin: string | null
  notes: string | null
  bookingDate: Date | string | null
  bookingTime: string | null
  durationMinutes: number
  price: number
  currency: string
  status: GarageBookingStatus
  linkedOrderId: string | null
  slotSelectedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type ServiceRow = {
  id: string
  name: string
  durationMinutes: number
  price: number
  currency: string
}

type UserGarageBookingRow = GarageBookingRow & {
  garageName: string | null
  linkedOrderPublicId: string | null
  linkedOrderDelivered: boolean | null
  reviewId: string | null
  reviewRating: number | null
  reviewComment: string | null
  reviewGarageReply: string | null
}

type BookingCustomer = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const requiredText = (value: unknown, label: string, maxLength = 160) => {
  const normalized = text(value)
  if (!normalized) throw new Error(`${label} is required`)
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`)
  }
  return normalized
}

const optionalText = (value: unknown, label: string, maxLength = 160) => {
  const normalized = text(value)
  if (!normalized) return null
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`)
  }
  return normalized
}

const email = (value: unknown) => {
  const normalized = optionalText(value, "Email", 180)
  if (!normalized) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Email is invalid")
  }
  return normalized.toLowerCase()
}

const phone = (value: unknown) => {
  const normalized = requiredText(value, "Mobile number", 15)
  if (!/^\d{7,15}$/.test(normalized)) {
    throw new Error("Mobile number must contain 7 to 15 digits")
  }
  return normalized
}

const vehicleYear = (value: unknown) => {
  const normalized = optionalText(value, "Vehicle year", 4)
  if (!normalized) return null
  const maxYear = new Date().getFullYear() + 1
  const parsed = Number(normalized)
  if (!/^\d{4}$/.test(normalized) || parsed < 1900 || parsed > maxYear) {
    throw new Error(`Vehicle year must be between 1900 and ${maxYear}`)
  }
  return normalized
}

const vehicleVin = (value: unknown) => {
  const normalized = optionalText(value, "VIN", 17)?.toUpperCase() ?? null
  if (!normalized) return null
  if (!/^[A-HJ-NPR-Z0-9]{5,17}$/.test(normalized)) {
    throw new Error("VIN must be 5 to 17 letters/numbers and cannot include I, O, or Q")
  }
  return normalized
}

const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex")

const otpText = (value: unknown) => {
  const normalized = text(value).replace(/\D/g, "")
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("Enter the 6-digit OTP sent to the customer")
  }
  return normalized
}

const bookingDate = (value: unknown) => {
  const normalized = requiredText(value, "Booking date", 20)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Booking date must use YYYY-MM-DD")
  }
  return normalized
}

const timeToMinutes = (value: unknown) => {
  const normalized = requiredText(value, "Booking time", 20).toUpperCase()
  const match = normalized.match(/^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/)
  if (!match) throw new Error("Booking time must use h:mm AM/PM")
  const minute = Number(match[2])
  if (minute % 15 !== 0) throw new Error("Booking time must use a 15-minute slot")
  const hour = Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0)
  return hour * 60 + minute
}

const minutesToTime = (minutes: number) => {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour = hour24 % 12 || 12
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`
}

async function assertGarageSlotAvailable(
  tx: Prisma.TransactionClient,
  garageId: string,
  date: string,
  time: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${garageId}:${date}`}))`
  const existing = await tx.$queryRaw<Array<{ bookingTime: string; durationMinutes: number }>>`
    SELECT "bookingTime", "durationMinutes"
    FROM "garage_bookings"
    WHERE "garageId" = ${garageId}
      AND "bookingDate" = ${date}::date
      AND "status" <> 'cancelled'::"GarageBookingStatus"
  `
  const requestedStart = timeToMinutes(time)
  const requestedEnd = requestedStart + 15
  const overlaps = existing.some((booking) => {
    const existingStart = timeToMinutes(booking.bookingTime)
    const existingEnd = existingStart + 15
    return requestedStart < existingEnd && requestedEnd > existingStart
  })
  if (overlaps) throw new Error("This appointment slot is no longer available")
}

export async function getPublicGarageBookingAvailability(input: {
  garageId: string
  serviceId: string
  bookingDate: string
}) {
  const garageId = requiredText(input.garageId, "Garage")
  const serviceId = requiredText(input.serviceId, "Service")
  const date = bookingDate(input.bookingDate)
  const service = await db.garageService.findFirst({
    where: { id: serviceId, garageId, status: "active" },
    select: { durationMinutes: true },
  })
  if (!service) throw new Error("Service not found for this garage")
  const bookings = await db.garageBooking.findMany({
    where: { garageId, bookingDate: new Date(`${date}T00:00:00.000Z`), status: { not: "cancelled" } },
    select: { bookingTime: true, durationMinutes: true },
  })
  const unavailableTimes: string[] = []
  for (let start = 9 * 60; start <= 17 * 60 + 30; start += 15) {
    const end = start + 15
    if (bookings.some((booking) => {
      const bookedStart = timeToMinutes(booking.bookingTime)
      return start < bookedStart + 15 && end > bookedStart
    })) unavailableTimes.push(minutesToTime(start))
  }
  return {
    unavailableTimes,
    slotIntervalMinutes: 15,
    advance: await getGarageBookingAdvanceSetting(),
  }
}

const offlineBookingDate = (value: unknown) => {
  const normalized = bookingDate(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const appointmentDate = new Date(`${normalized}T00:00:00`)
  if (appointmentDate < today) {
    throw new Error("Appointment date cannot be in the past")
  }
  return normalized
}

const bookingStatus = (value: unknown) => {
  const normalized = text(value).toLowerCase()
  if (
    normalized !== "pending" &&
    normalized !== "pending_slot_selection" &&
    normalized !== "confirmed" &&
    normalized !== "completed" &&
    normalized !== "cancelled"
  ) {
    throw new Error("Booking status is invalid")
  }
  return normalized as GarageBookingStatus
}

const mapBooking = (row: GarageBookingRow): GarageBookingRecord => ({
  ...row,
  bookingDate: row.bookingDate
    ? row.bookingDate instanceof Date
      ? row.bookingDate.toISOString().slice(0, 10)
      : String(row.bookingDate).slice(0, 10)
    : null,
  bookingTime: row.bookingTime,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const bookingSelect = Prisma.sql`
  SELECT
    "id",
    "publicId",
    "garageId",
    "customerId",
    "serviceId",
    "serviceName",
    "customerName",
    "customerEmail",
    "customerPhone",
    "vehicleYear",
    "vehicleMake",
    "vehicleModel",
    "vehicleVin",
    "notes",
    "bookingDate",
    "bookingTime",
    "durationMinutes",
    "price",
    "currency",
    "status",
    "createdAt",
    "updatedAt"
  FROM "garage_bookings"
`

async function notifyGarageBookingCreated(booking: GarageBookingRecord) {
  const adminIds = await activeAdminRecipientIds()
  const notifications: CreateNotificationInput[] = [
    {
      recipientUserId: booking.garageId,
      actorUserId: booking.customerId,
      type: "booking.created",
      title: "New service booking",
      body: `${booking.customerName} booked ${booking.serviceName} for ${booking.bookingDate}.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: booking.id,
    },
    ...adminIds.map((adminId) => ({
      recipientAdminId: adminId,
      actorUserId: booking.customerId,
      type: "booking.created",
      title: "New garage booking",
      body: `${booking.customerName} booked ${booking.serviceName}.`,
      linkUrl: "/garages",
      entityType: "garage_booking",
      entityId: booking.id,
    })),
  ]

  if (booking.customerId) {
    notifications.push({
      recipientUserId: booking.customerId,
      type: "booking.created",
      title: "Booking confirmed",
      body: `${booking.serviceName} is booked for ${booking.bookingDate}.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: booking.id,
    })
  }

  await createNotificationsSafely(notifications)
}

async function notifyGarageBookingStatusChanged(booking: GarageBookingRecord) {
  const notifications: CreateNotificationInput[] = []

  if (booking.customerId) {
    notifications.push({
      recipientUserId: booking.customerId,
      actorUserId: booking.garageId,
      type: "booking.status.updated",
      title: "Booking status updated",
      body: `${booking.serviceName} is now ${booking.status}.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: booking.id,
    })
  }

  const adminIds = await activeAdminRecipientIds()
  notifications.push(
    ...adminIds.map((adminId) => ({
      recipientAdminId: adminId,
      actorUserId: booking.garageId,
      type: "booking.status.updated",
      title: "Garage booking status updated",
      body: `${booking.publicId} is now ${booking.status}.`,
      linkUrl: "/garages",
      entityType: "garage_booking",
      entityId: booking.id,
    })),
  )

  await createNotificationsSafely(notifications)
}

export async function createPublicGarageBooking(
  customer: BookingCustomer,
  input: GarageBookingInput,
) {
  const garageId = requiredText(input.garageId, "Garage")
  const serviceId = requiredText(input.serviceId, "Service")
  const customerName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    customer.email ||
    customer.phone ||
    "Customer"
  const customerEmail = email(customer.email ?? input.customerEmail)
  const customerPhone = text(customer.phone ?? input.customerPhone) || "Not provided"
  const vehicleYear = optionalText(input.vehicleYear, "Vehicle year", 20)
  const vehicleMake = optionalText(input.vehicleMake, "Vehicle make", 80)
  const vehicleModel = optionalText(input.vehicleModel, "Vehicle model", 80)
  const vehicleVin = optionalText(input.vehicleVin, "VIN", 40)?.toUpperCase() ?? null
  const notes = optionalText(input.notes, "Notes", 500)
  const date = bookingDate(input.bookingDate)
  const time = minutesToTime(timeToMinutes(input.bookingTime))

  const [garage] = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "users"
    WHERE "id" = ${garageId}
      AND "isActive" = true
      AND ('Garage'::"UserRole" = ANY("roles") OR "activeRole" = 'Garage'::"UserRole")
    LIMIT 1
  `

  if (!garage) throw new Error("Garage not found")

  const [service] = await db.$queryRaw<ServiceRow[]>`
    SELECT "id", "name", "durationMinutes", "price", "currency"
    FROM "garage_services"
    WHERE "id" = ${serviceId}
      AND "garageId" = ${garageId}
      AND "status" = 'active'::"GarageServiceStatus"
    LIMIT 1
  `

  if (!service) throw new Error("Service not found for this garage")

  const advance = await getGarageBookingAdvanceSetting()
  const advanceAmount = calculateGarageBookingAdvanceAmount(service.price, advance)

  const [booking] = await db.$transaction(async (tx) => {
    await assertGarageSlotAvailable(tx, garageId, date, time)
    const rows = await tx.$queryRaw<GarageBookingRow[]>`
      INSERT INTO "garage_bookings" (
        "id",
        "garageId",
        "customerId",
        "serviceId",
        "serviceName",
        "customerName",
        "customerEmail",
        "customerPhone",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVin",
        "notes",
        "bookingDate",
        "bookingTime",
        "durationMinutes",
        "price",
        "currency",
        "advancePercentage",
        "advanceAmount",
        "advancePaymentStatus",
        "advancePaidAt",
        "status",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${garageId},
        ${customer.id},
        ${service.id},
        ${service.name},
        ${customerName},
        ${customerEmail},
        ${customerPhone},
        ${vehicleYear},
        ${vehicleMake},
        ${vehicleModel},
        ${vehicleVin},
        ${notes},
        ${date}::date,
        ${time},
        ${service.durationMinutes},
        ${service.price},
        ${service.currency},
        ${advance.mode === "percentage" ? advance.value : null},
        ${advanceAmount},
        'succeeded',
        CURRENT_TIMESTAMP,
        'confirmed'::"GarageBookingStatus",
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "publicId",
        "garageId",
        "customerId",
        "serviceId",
        "serviceName",
        "customerName",
        "customerEmail",
        "customerPhone",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVin",
        "notes",
        "bookingDate",
        "bookingTime",
        "durationMinutes",
        "price",
    "currency",
    "status",
    "linkedOrderId",
    "slotSelectedAt",
    "createdAt",
    "updatedAt"
`

    await tx.$executeRaw`
      UPDATE "garage_services"
      SET "bookingsCount" = "bookingsCount" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${service.id}
    `

    return rows
  })

  const mappedBooking = mapBooking(booking)
  await notifyGarageBookingCreated(mappedBooking)
  return {
    booking: mappedBooking,
    payment: {
      mode: advance.mode,
      value: advance.value,
      percentage: advance.mode === "percentage" ? advance.value : null,
      amount: advanceAmount / 100,
      currency: service.currency,
      status: "succeeded" as const,
    },
  }
}

export async function createGarageOfflineBooking(
  garageId: string,
  input: GarageOfflineBookingInput,
) {
  const serviceId = requiredText(input.serviceId, "Service")
  const customerName = requiredText(input.customerName, "Customer name", 160)
  const customerEmail = email(input.customerEmail)
  const customerPhone = phone(input.customerPhone)
  const vehicleYearValue = vehicleYear(input.vehicleYear)
  const vehicleMake = optionalText(input.vehicleMake, "Vehicle make", 80)
  const vehicleModel = optionalText(input.vehicleModel, "Vehicle model", 80)
  const vehicleVinValue = vehicleVin(input.vehicleVin)
  const notes = optionalText(input.notes, "Notes", 500)
  const date = offlineBookingDate(input.bookingDate)
  const time = minutesToTime(timeToMinutes(input.bookingTime))

  const [service] = await db.$queryRaw<ServiceRow[]>`
    SELECT "id", "name", "durationMinutes", "price", "currency"
    FROM "garage_services"
    WHERE "id" = ${serviceId}
      AND "garageId" = ${garageId}
      AND "status" = 'active'::"GarageServiceStatus"
    LIMIT 1
  `

  if (!service) throw new Error("Active service not found for this garage")

  const [booking] = await db.$transaction(async (tx) => {
    await assertGarageSlotAvailable(tx, garageId, date, time)
    const rows = await tx.$queryRaw<GarageBookingRow[]>`
      INSERT INTO "garage_bookings" (
        "id",
        "garageId",
        "customerId",
        "serviceId",
        "serviceName",
        "customerName",
        "customerEmail",
        "customerPhone",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVin",
        "notes",
        "bookingDate",
        "bookingTime",
        "durationMinutes",
        "price",
        "currency",
        "status",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${garageId},
        NULL,
        ${service.id},
        ${service.name},
        ${customerName},
        ${customerEmail},
        ${customerPhone},
        ${vehicleYearValue},
        ${vehicleMake},
        ${vehicleModel},
        ${vehicleVinValue},
        ${notes},
        ${date}::date,
        ${time},
        ${service.durationMinutes},
        ${service.price},
        ${service.currency},
        'confirmed'::"GarageBookingStatus",
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "publicId",
        "garageId",
        "customerId",
        "serviceId",
        "serviceName",
        "customerName",
        "customerEmail",
        "customerPhone",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVin",
        "notes",
        "bookingDate",
        "bookingTime",
        "durationMinutes",
        "price",
        "currency",
        "status",
        "linkedOrderId",
        "slotSelectedAt",
        "createdAt",
        "updatedAt"
    `

    await tx.$executeRaw`
      UPDATE "garage_services"
      SET "bookingsCount" = "bookingsCount" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${service.id}
    `

    return rows
  })

  return mapBooking(booking)
}

export async function scheduleUserGarageBookingSlot(
  customerId: string,
  bookingId: string,
  input: {
    bookingDate?: unknown
    bookingTime?: unknown
    vehicleYear?: unknown
    vehicleMake?: unknown
    vehicleModel?: unknown
    vehicleVin?: unknown
  },
) {
  const trimmedBookingId = requiredText(bookingId, "Booking")
  const date = offlineBookingDate(input.bookingDate)
  const time = minutesToTime(timeToMinutes(input.bookingTime))
  const selectedVehicleYear = optionalText(input.vehicleYear, "Vehicle year", 20)
  const selectedVehicleMake = optionalText(input.vehicleMake, "Vehicle make", 80)
  const selectedVehicleModel = optionalText(input.vehicleModel, "Vehicle model", 80)
  const selectedVehicleVin =
    optionalText(input.vehicleVin, "VIN", 40)?.toUpperCase() ?? null

  const [booking] = await db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<{
      id: string
      garageId: string
      linkedOrderId: string | null
      status: GarageBookingStatus
    }>>`
      SELECT "id", "garageId", "linkedOrderId", "status"
      FROM "garage_bookings"
      WHERE "customerId" = ${customerId}
        AND ("id" = ${trimmedBookingId} OR "publicId" = ${trimmedBookingId})
      LIMIT 1
    `

    if (!existing) throw new Error("Booking not found")
    if (existing.status !== "pending_slot_selection") {
      throw new Error("This service booking already has a slot")
    }
    if (!existing.linkedOrderId) {
      throw new Error("This booking is not linked to a delivered product order")
    }

    const order = await tx.order.findFirst({
      where: {
        id: existing.linkedOrderId,
        buyerId: customerId,
        status: OrderStatus.delivered,
      },
      select: {
        id: true,
        items: { select: { deliveredAt: true } },
      },
    })
    if (!order || order.items.some((item) => !item.deliveredAt)) {
      throw new Error("Select a service slot after all linked parts are delivered")
    }

    await assertGarageSlotAvailable(tx, existing.garageId, date, time)

    return tx.$queryRaw<GarageBookingRow[]>`
      UPDATE "garage_bookings"
      SET "bookingDate" = ${date}::date,
          "bookingTime" = ${time},
          "vehicleYear" = COALESCE(${selectedVehicleYear}, "vehicleYear"),
          "vehicleMake" = COALESCE(${selectedVehicleMake}, "vehicleMake"),
          "vehicleModel" = COALESCE(${selectedVehicleModel}, "vehicleModel"),
          "vehicleVin" = COALESCE(${selectedVehicleVin}, "vehicleVin"),
          "status" = 'confirmed'::"GarageBookingStatus",
          "slotSelectedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing.id}
      RETURNING
        "id",
        "publicId",
        "garageId",
        "customerId",
        "serviceId",
        "serviceName",
        "customerName",
        "customerEmail",
        "customerPhone",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVin",
        "notes",
        "bookingDate",
        "bookingTime",
        "durationMinutes",
        "price",
        "currency",
        "status",
        "linkedOrderId",
        "slotSelectedAt",
        "createdAt",
        "updatedAt"
    `
  })

  if (!booking) throw new Error("Unable to schedule booking")
  const mappedBooking = mapBooking(booking)
  await notifyGarageBookingCreated(mappedBooking)
  return mappedBooking
}

export async function listGarageBookings(garageId: string) {
  const rows = await db.$queryRaw<GarageBookingRow[]>`
    ${bookingSelect}
    WHERE "garageId" = ${garageId}
    ORDER BY "createdAt" DESC, "bookingDate" DESC, "bookingTime" DESC
  `
  return rows.map(mapBooking)
}

export async function updateGarageBookingStatus(
  garageId: string,
  bookingId: string,
  status: unknown,
  options: { completionOtp?: unknown } = {},
) {
  const nextStatus = bookingStatus(status)

  if (nextStatus === "completed") {
    await verifyGarageBookingCompletionOtp(garageId, bookingId, options.completionOtp)
  }

  const [booking] = await db.$queryRaw<GarageBookingRow[]>`
    UPDATE "garage_bookings"
    SET "status" = ${nextStatus}::"GarageBookingStatus",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "garageId" = ${garageId}
      AND ("id" = ${bookingId} OR "publicId" = ${bookingId})
    RETURNING
      "id",
      "publicId",
      "garageId",
      "customerId",
      "serviceId",
      "serviceName",
      "customerName",
      "customerEmail",
      "customerPhone",
      "vehicleYear",
      "vehicleMake",
      "vehicleModel",
      "vehicleVin",
      "notes",
      "bookingDate",
      "bookingTime",
      "durationMinutes",
      "price",
      "currency",
      "status",
      "linkedOrderId",
      "slotSelectedAt",
      "createdAt",
      "updatedAt"
  `

  if (!booking) throw new Error("Booking not found")
  const mappedBooking = mapBooking(booking)
  await notifyGarageBookingStatusChanged(mappedBooking)
  return mappedBooking
}

export async function requestGarageBookingCompletionOtp(
  garageId: string,
  bookingId: string,
) {
  const trimmedBookingId = requiredText(bookingId, "Booking")
  const [booking] = await db.$queryRaw<Array<{
    id: string
    publicId: string
    garageId: string
    customerName: string
    customerEmail: string | null
    serviceName: string
    status: GarageBookingStatus
  }>>`
    SELECT
      "id",
      "publicId",
      "garageId",
      "customerName",
      "customerEmail",
      "serviceName",
      "status"
    FROM "garage_bookings"
    WHERE "garageId" = ${garageId}
      AND ("id" = ${trimmedBookingId} OR "publicId" = ${trimmedBookingId})
    LIMIT 1
  `

  if (!booking) throw new Error("Booking not found")
  if (booking.status === "completed") {
    throw new Error("This booking is already completed")
  }
  if (booking.status === "cancelled") {
    throw new Error("Cancelled bookings cannot be completed")
  }
  if (!booking.customerEmail) {
    throw new Error("Customer email is not available for this booking")
  }

  const otp = String(randomInt(100000, 1000000))
  await db.$executeRaw`
    INSERT INTO "garage_booking_completion_otps" (
      "id",
      "bookingId",
      "garageId",
      "customerEmail",
      "otpHash",
      "expiresAt"
    )
    VALUES (
      ${randomUUID()},
      ${booking.id},
      ${garageId},
      ${booking.customerEmail},
      ${hashSecret(otp)},
      CURRENT_TIMESTAMP + INTERVAL '10 minutes'
    )
  `

  await sendSmtpMail({
    to: booking.customerEmail,
    subject: "Confirm garage service completion OTP",
    text: [
      `Your OTP is ${otp}.`,
      "",
      `Share this OTP with the garage only if ${booking.serviceName} for booking ${booking.publicId} has been completed.`,
      "This OTP expires in 10 minutes.",
    ].join("\n"),
    html: [
      `<p>Your OTP is <strong>${otp}</strong>.</p>`,
      `<p>Share this OTP with the garage only if <strong>${booking.serviceName}</strong> for booking <strong>${booking.publicId}</strong> has been completed.</p>`,
      "<p>This OTP expires in 10 minutes.</p>",
    ].join(""),
  })

  return {
    ok: true,
    message: `Completion OTP sent to ${booking.customerEmail}`,
  }
}

async function verifyGarageBookingCompletionOtp(
  garageId: string,
  bookingId: string,
  otp: unknown,
) {
  const normalizedOtp = otpText(otp)
  const trimmedBookingId = requiredText(bookingId, "Booking")
  const [request] = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "garage_booking_completion_otps"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT gbc."id"
      FROM "garage_booking_completion_otps" gbc
      JOIN "garage_bookings" gb ON gb."id" = gbc."bookingId"
      WHERE gbc."garageId" = ${garageId}
        AND (gb."id" = ${trimmedBookingId} OR gb."publicId" = ${trimmedBookingId})
        AND gbc."otpHash" = ${hashSecret(normalizedOtp)}
        AND gbc."expiresAt" > CURRENT_TIMESTAMP
        AND gbc."consumedAt" IS NULL
        AND gb."status" <> 'completed'::"GarageBookingStatus"
      ORDER BY gbc."createdAt" DESC
      LIMIT 1
    )
    RETURNING "id"
  `

  if (!request) throw new Error("Completion OTP is invalid or expired")
}

export async function listUserGarageBookings(customerId: string) {
  const rows = await db.$queryRaw<UserGarageBookingRow[]>`
    SELECT
      gb."id",
      gb."publicId",
      gb."garageId",
      gb."customerId",
      gb."serviceId",
      gb."serviceName",
      gb."customerName",
      gb."customerEmail",
      gb."customerPhone",
      gb."vehicleYear",
      gb."vehicleMake",
      gb."vehicleModel",
      gb."vehicleVin",
      gb."notes",
      gb."bookingDate",
      gb."bookingTime",
      gb."durationMinutes",
      gb."price",
      gb."currency",
      gb."status",
      gb."linkedOrderId",
      gb."slotSelectedAt",
      gb."createdAt",
      gb."updatedAt",
      COALESCE(
        g."companyName",
        NULLIF(CONCAT_WS(' ', g."firstName", g."lastName"), ''),
        g."email",
        'Garage'
      ) AS "garageName",
      gsr."id" AS "reviewId",
      gsr."rating" AS "reviewRating",
      gsr."comment" AS "reviewComment",
      gsr."garageReply" AS "reviewGarageReply",
      o."publicId" AS "linkedOrderPublicId",
      CASE
        WHEN o."id" IS NULL THEN NULL
        WHEN o."status" = 'delivered'::"OrderStatus"
          AND NOT EXISTS (
            SELECT 1
            FROM "order_items" oi
            WHERE oi."orderId" = o."id"
              AND oi."deliveredAt" IS NULL
          )
        THEN TRUE
        ELSE FALSE
      END AS "linkedOrderDelivered"
    FROM "garage_bookings" gb
    LEFT JOIN "users" g ON g."id" = gb."garageId"
    LEFT JOIN "orders" o ON o."id" = gb."linkedOrderId"
    LEFT JOIN LATERAL (
      SELECT r."id", r."rating", r."comment", r."garageReply"
      FROM "garage_service_reviews" r
      WHERE r."bookingId" = gb."id"
        OR (
          r."bookingId" IS NULL
          AND r."customerId" = gb."customerId"
          AND r."serviceId" = gb."serviceId"
        )
      ORDER BY
        CASE WHEN r."bookingId" = gb."id" THEN 0 ELSE 1 END,
        r."createdAt" DESC
      LIMIT 1
    ) gsr ON TRUE
    WHERE gb."customerId" = ${customerId}
    ORDER BY gb."createdAt" DESC, gb."bookingDate" DESC, gb."bookingTime" DESC
  `

  return rows.map((row): UserGarageBookingRecord => ({
    ...mapBooking(row),
    garageName: row.garageName,
    canSelectSlot:
      row.status === "pending_slot_selection" &&
      Boolean(row.linkedOrderId && row.linkedOrderDelivered),
    reviewId: row.reviewId,
    reviewRating: row.reviewRating,
    reviewComment: row.reviewComment,
    reviewGarageReply: row.reviewGarageReply,
  }))
}
