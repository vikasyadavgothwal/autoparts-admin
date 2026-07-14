import { randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import {
  activeAdminRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service"
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
  bookingDate: Date | string
  bookingTime: string
  durationMinutes: number
  price: number
  currency: string
  status: GarageBookingStatus
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

const bookingDate = (value: unknown) => {
  const normalized = requiredText(value, "Booking date", 20)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Booking date must use YYYY-MM-DD")
  }
  return normalized
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
  bookingDate:
    row.bookingDate instanceof Date
      ? row.bookingDate.toISOString().slice(0, 10)
      : String(row.bookingDate).slice(0, 10),
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
  const time = requiredText(input.bookingTime, "Booking time", 40)

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

  const [booking] = await db.$transaction(async (tx) => {
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
  return mappedBooking
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
  const time = requiredText(input.bookingTime, "Booking time", 40)

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
) {
  const nextStatus = bookingStatus(status)
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
      "createdAt",
      "updatedAt"
  `

  if (!booking) throw new Error("Booking not found")
  const mappedBooking = mapBooking(booking)
  await notifyGarageBookingStatusChanged(mappedBooking)
  return mappedBooking
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
      gsr."garageReply" AS "reviewGarageReply"
    FROM "garage_bookings" gb
    LEFT JOIN "users" g ON g."id" = gb."garageId"
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
    reviewId: row.reviewId,
    reviewRating: row.reviewRating,
    reviewComment: row.reviewComment,
    reviewGarageReply: row.reviewGarageReply,
  }))
}
