import { randomUUID } from "node:crypto"

import { Star, TrendingUp, Users, Wrench } from "lucide-react"

import { db } from "@/lib/database/prisma"
import { BusinessAccountType, Prisma } from "@/lib/generated/prisma/client"
import { logBusinessActivity } from "@/services/business/business-platform-service"
import { createNotificationsSafely } from "@/services/notifications/notification-service"
import type {
  AdminGarageBookingRecord,
  GarageKpi,
  GarageRecord,
  GarageStatus,
} from "@/types/admin-dashboard/garages/garages-types"
import type { GarageServiceReviewRecord } from "@/types/garage/reviews"

type GarageRow = {
  id: string
  publicId: string
  garagePublicId: string | null
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  companyName: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  country: string | null
  isActive: boolean
  emailVerifiedAt: Date | null
  createdAt: Date
  profileContactEmail: string | null
  profileContactEmailVerifiedAt: Date | null
  profileMobile: string | null
  profileMobileVerifiedAt: Date | null
  profileAddress: string | null
  profileCity: string | null
  profileState: string | null
  profileCountry: string | null
  bookingsCount: bigint | number
  revenueCents: bigint | number | null
  ratingAverage: number | string | null
  reviewsCount: bigint | number | null
  reviews: GarageServiceReviewRecord[] | null
}

const WORKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const
type GarageScheduleDay = (typeof WORKDAY_NAMES)[number]
const WORKDAY_SET = new Set(WORKDAY_NAMES)

type GarageProfileSchedule = {
  workingDays: string[]
  workingHoursByDay: Record<string, { enabled?: boolean }>
}

type GarageProfileRecordRow = {
  workingDays: string[]
  workingHoursByDay: Record<string, unknown> | null
}

type BookingDateRow = {
  bookingDate: string | null
}

type AdminGarageBookingRow = AdminGarageBookingRecord & {
  garageId: string
}

type GarageAdminScheduleInput = {
  workingDays?: unknown
  workingHoursByDay?: unknown
}

export type GarageAdminUpdateInput = {
  name?: unknown
  owner?: unknown
  email?: unknown
  phone?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  country?: unknown
  workingDays?: unknown
  workingHoursByDay?: unknown
  status?: unknown
}

export type GarageBookingAdminCompletionOverrideInput = {
  reason?: unknown
  evidence?: unknown
}

const text = (value: unknown, maxLength = 180) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  return normalized.slice(0, maxLength)
}

const optionalText = (value: unknown, maxLength = 180) => {
  const normalized = text(value, maxLength)
  return normalized || null
}

const requiredReviewText = (value: unknown, label: string, minLength: number, maxLength: number) => {
  const normalized = text(value, maxLength)
  if (normalized.length < minLength) {
    throw new Error(`${label} must be at least ${minLength} characters`)
  }
  return normalized
}

const email = (value: unknown) => {
  const normalized = optionalText(value, 180)
  if (!normalized) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Email is invalid")
  }
  return normalized.toLowerCase()
}

const splitOwnerName = (owner: string) => {
  const parts = owner.split(" ").filter(Boolean)
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  }
}

const statusFromInput = (value: unknown) => {
  const normalized = text(value, 20)
  if (
    normalized !== "Active" &&
    normalized !== "Pending" &&
    normalized !== "Suspended"
  ) {
    throw new Error("Status is invalid")
  }
  return normalized as GarageStatus
}

const daysFromInput = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => WORKDAY_SET.has(item))
    : []

const hoursByInput = (value: unknown): Record<string, { enabled?: boolean }> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  const input = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(input)
      .filter(
        (entry): entry is [GarageScheduleDay, unknown] =>
          WORKDAY_SET.has(entry[0] as GarageScheduleDay) &&
          Boolean(entry[1]),
      )
      .map(([day, rawValue]) => [
        day,
        { enabled: Boolean((rawValue as { enabled?: unknown })?.enabled) },
      ]),
  )
}

const toAvailability = (schedule: GarageProfileSchedule) => {
  const hasHoursByDay = Object.keys(schedule.workingHoursByDay).length > 0
  const selectedDays = hasHoursByDay
    ? Object.entries(schedule.workingHoursByDay)
        .filter(([, dayHours]) => Boolean(dayHours?.enabled))
        .map(([day]) => day)
    : schedule.workingDays

  const availability = Object.fromEntries(
    WORKDAY_NAMES.map((day) => [day, false]),
  ) as Record<string, boolean>

  if (selectedDays.length === 0) {
    for (const day of WORKDAY_NAMES) {
      availability[day] = true
    }
    return availability
  }

  for (const day of selectedDays) {
    availability[day] = true
  }

  return availability
}

const parseProfileSchedule = (profile: GarageProfileRecordRow): GarageProfileSchedule => ({
  workingDays: (profile.workingDays ?? []).filter(
    (day): day is GarageScheduleDay => WORKDAY_SET.has(day as GarageScheduleDay),
  ),
  workingHoursByDay:
    profile.workingHoursByDay && typeof profile.workingHoursByDay === "object"
      ? (profile.workingHoursByDay as Record<string, { enabled?: boolean }>)
      : {},
})

const bookingDayName = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })

const findBlockedClosedDays = (
  previous: GarageProfileSchedule,
  next: GarageProfileSchedule,
) => {
  const previousAvailability = toAvailability(previous)
  const nextAvailability = toAvailability(next)

  return WORKDAY_NAMES.filter(
    (day) => previousAvailability[day] && !nextAvailability[day],
  )
}

const ensureNoActiveBookingsForClosedDays = async (
  garageId: string,
  input: GarageAdminScheduleInput,
) => {
  if (!("workingDays" in input) && !("workingHoursByDay" in input)) return

  const [currentProfile] = await db.$queryRaw<GarageProfileRecordRow[]>`
    SELECT
      COALESCE("workingDays", ARRAY[]::text[]) AS "workingDays",
      "workingHoursByDay"
    FROM "garage_profiles"
    WHERE "garageId" = ${garageId}
    LIMIT 1
  `
  if (!currentProfile) return

  const currentSchedule = parseProfileSchedule(currentProfile)
  const requestedSchedule: GarageProfileSchedule = {
    workingDays: daysFromInput(input.workingDays),
    workingHoursByDay: hoursByInput(input.workingHoursByDay),
  }
  const closedDays = findBlockedClosedDays(currentSchedule, requestedSchedule)
  if (closedDays.length === 0) return

  const pendingBookings = await db.$queryRaw<BookingDateRow[]>`
    SELECT "bookingDate"::text AS "bookingDate"
    FROM "garage_bookings"
    WHERE "garageId" = ${garageId}
      AND "status" IN ('pending', 'pending_slot_selection', 'confirmed')
      AND "bookingDate" IS NOT NULL
  `
  const blockedDays = closedDays.filter((day) =>
    pendingBookings.some(
      (booking) =>
        booking.bookingDate &&
        bookingDayName(booking.bookingDate) === day,
    ),
  )
  if (blockedDays.length === 0) return

  if (blockedDays.length === 1) {
    throw new Error(
      `Complete booking(s) on ${blockedDays[0]} before marking this day as closed.`,
    )
  }

  throw new Error(
    `Complete active bookings on ${blockedDays.join(", ")} before marking these days as closed.`,
  )
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

const formatMoney = (amount: number) =>
  `AED ${(amount / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const asNumber = (value: bigint | number | null) =>
  typeof value === "bigint" ? Number(value) : value ?? 0

const garageName = (row: GarageRow) =>
  row.companyName || row.profileContactEmail || row.email || "Garage"

const ownerName = (row: GarageRow) =>
  [row.firstName, row.lastName].filter(Boolean).join(" ") ||
  row.email ||
  row.phone ||
  "Not added"

const rowStatus = (row: GarageRow): GarageStatus => {
  if (!row.isActive) return "Suspended"
  if (!row.emailVerifiedAt && !row.profileContactEmailVerifiedAt) return "Pending"
  return "Active"
}

const mapGarage = (row: GarageRow): GarageRecord => {
  const city = row.profileCity || row.city || ""
  const state = row.profileState || row.state || ""
  const country = row.profileCountry || row.country || ""
  const location = [city, state, country].filter(Boolean).join(", ") || "Not added"

  return {
    internalId: row.id,
    id: row.garagePublicId ?? row.publicId,
    accountId: row.publicId,
    name: garageName(row),
    owner: ownerName(row),
    email: row.profileContactEmail || row.email || "",
    phone: row.profileMobile || row.phone || "",
    location,
    address: row.profileAddress || row.addressLine1 || "",
    city,
    state,
    country,
    rating: row.reviewsCount ? String(Number(row.ratingAverage ?? 0)) : "No reviews",
    reviewsCount: asNumber(row.reviewsCount),
    reviews: row.reviews ?? [],
    activeBookings: [],
    bookings: asNumber(row.bookingsCount),
    revenue: formatMoney(asNumber(row.revenueCents)),
    joinDate: formatDate(row.createdAt),
    status: rowStatus(row),
    verified: Boolean(
      row.emailVerifiedAt ||
        row.profileContactEmailVerifiedAt ||
        row.profileMobileVerifiedAt,
    ),
  }
}

const mapAdminGarageBooking = (row: AdminGarageBookingRow): AdminGarageBookingRecord => ({
  id: row.id,
  publicId: row.publicId,
  customerId: row.customerId,
  customerName: row.customerName,
  customerEmail: row.customerEmail,
  customerPhone: row.customerPhone,
  serviceName: row.serviceName,
  bookingDate: row.bookingDate ? String(row.bookingDate).slice(0, 10) : null,
  bookingTime: row.bookingTime,
  status: row.status,
})

export async function listAdminGarages() {
  const rows = await db.$queryRaw<GarageRow[]>`
    SELECT
      u."id",
      u."publicId",
      u."garagePublicId",
      u."email",
      u."phone",
      u."firstName",
      u."lastName",
      u."companyName",
      u."addressLine1",
      u."city",
      u."state",
      u."country",
      u."isActive",
      u."emailVerifiedAt",
      u."createdAt",
      gp."contactEmail" AS "profileContactEmail",
      gp."contactEmailVerifiedAt" AS "profileContactEmailVerifiedAt",
      gp."mobile" AS "profileMobile",
      gp."mobileVerifiedAt" AS "profileMobileVerifiedAt",
      gp."address" AS "profileAddress",
      gp."city" AS "profileCity",
      gp."state" AS "profileState",
      gp."country" AS "profileCountry",
      COUNT(DISTINCT gb."id") AS "bookingsCount",
      COALESCE(
        (
          SELECT SUM(gb_revenue."price")
          FROM "garage_bookings" gb_revenue
          WHERE gb_revenue."garageId" = u."id"
        ),
        0
      ) AS "revenueCents",
      COALESCE(ROUND(AVG(gsr."rating")::numeric, 1), 0) AS "ratingAverage",
      COUNT(DISTINCT gsr."id") AS "reviewsCount",
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', review_rows."id",
              'garageId', review_rows."garageId",
              'serviceId', review_rows."serviceId",
              'customerId', review_rows."customerId",
              'bookingId', review_rows."bookingId",
              'serviceName', review_rows."serviceName",
              'customerName', review_rows."customerName",
              'rating', review_rows."rating",
              'comment', review_rows."comment",
              'garageReply', review_rows."garageReply",
              'garageReplyAt', review_rows."garageReplyAt",
              'createdAt', review_rows."createdAt",
              'updatedAt', review_rows."updatedAt"
            )
            ORDER BY review_rows."createdAt" DESC
          )
          FROM (
            SELECT
              r."id",
              r."garageId",
              r."serviceId",
              r."customerId",
              r."bookingId",
              COALESCE(gs."name", 'Service') AS "serviceName",
              COALESCE(NULLIF(CONCAT_WS(' ', cu."firstName", cu."lastName"), ''), cu."email", 'Customer') AS "customerName",
              r."rating",
              r."comment",
              r."garageReply",
              CASE WHEN r."garageReplyAt" IS NULL THEN NULL ELSE r."garageReplyAt"::text END AS "garageReplyAt",
              r."createdAt"::text AS "createdAt",
              r."updatedAt"::text AS "updatedAt"
            FROM "garage_service_reviews" r
            LEFT JOIN "garage_services" gs ON gs."id" = r."serviceId"
            LEFT JOIN "users" cu ON cu."id" = r."customerId"
            WHERE r."garageId" = u."id"
            ORDER BY r."createdAt" DESC
          ) review_rows
        ),
        '[]'::jsonb
      ) AS "reviews"
    FROM "users" u
    LEFT JOIN "garage_profiles" gp ON gp."garageId" = u."id"
    LEFT JOIN "garage_bookings" gb ON gb."garageId" = u."id"
    LEFT JOIN "garage_service_reviews" gsr ON gsr."garageId" = u."id"
    WHERE 'Garage'::"UserRole" = ANY(u."roles")
      OR u."activeRole" = 'Garage'::"UserRole"
    GROUP BY u."id", gp."id"
    ORDER BY u."createdAt" DESC
  `

  const garages = rows.map(mapGarage)
  const garageIds = garages.map((garage) => garage.internalId)

  if (garageIds.length === 0) return garages

  const bookingRows = await db.$queryRaw<AdminGarageBookingRow[]>`
    SELECT
      "id",
      "publicId",
      "garageId",
      "customerId",
      "customerName",
      "customerEmail",
      "customerPhone",
      "serviceName",
      "bookingDate"::text AS "bookingDate",
      "bookingTime",
      "status"
    FROM "garage_bookings"
    WHERE "garageId" IN (${Prisma.join(garageIds)})
      AND "status" IN ('pending', 'pending_slot_selection', 'confirmed')
    ORDER BY "bookingDate" ASC NULLS LAST, "bookingTime" ASC NULLS LAST, "createdAt" DESC
  `

  const bookingsByGarage = new Map<string, AdminGarageBookingRecord[]>()
  for (const row of bookingRows) {
    const bookings = bookingsByGarage.get(row.garageId) ?? []
    bookings.push(mapAdminGarageBooking(row))
    bookingsByGarage.set(row.garageId, bookings)
  }

  return garages.map((garage) => ({
    ...garage,
    activeBookings: bookingsByGarage.get(garage.internalId) ?? [],
  }))
}

export async function completeGarageBookingByAdmin(
  adminId: string,
  bookingId: string,
  input: GarageBookingAdminCompletionOverrideInput,
) {
  const reason = requiredReviewText(input.reason, "Override reason", 20, 500)
  const evidence = requiredReviewText(input.evidence, "Evidence note", 20, 1200)
  const trimmedBookingId = text(bookingId, 120)
  if (!trimmedBookingId) throw new Error("Booking is required")

  const [existing] = await db.$queryRaw<Array<AdminGarageBookingRow & {
    garageName: string | null
    businessAccountId: string | null
  }>>`
    SELECT
      gb."id",
      gb."publicId",
      gb."garageId",
      gb."customerId",
      gb."customerName",
      gb."customerEmail",
      gb."customerPhone",
      gb."serviceName",
      gb."bookingDate"::text AS "bookingDate",
      gb."bookingTime",
      gb."status",
      COALESCE(g."companyName", NULLIF(CONCAT_WS(' ', g."firstName", g."lastName"), ''), g."email") AS "garageName",
      ba."id" AS "businessAccountId"
    FROM "garage_bookings" gb
    LEFT JOIN "users" g ON g."id" = gb."garageId"
    LEFT JOIN "business_accounts" ba
      ON ba."ownerUserId" = gb."garageId"
      AND ba."type" = ${BusinessAccountType.Garage}::"BusinessAccountType"
    WHERE gb."id" = ${trimmedBookingId}
      OR gb."publicId" = ${trimmedBookingId}
    LIMIT 1
  `

  if (!existing) throw new Error("Booking not found")
  if (!existing.customerId) {
    throw new Error("Offline garage-created appointments do not need Admin OTP override")
  }
  if (existing.status === "completed") {
    throw new Error("This booking is already completed")
  }
  if (existing.status === "cancelled") {
    throw new Error("Cancelled bookings cannot be completed")
  }
  if (existing.status !== "confirmed") {
    throw new Error("Only confirmed customer bookings can be completed by Admin override")
  }
  if (!existing.bookingDate || !existing.bookingTime) {
    throw new Error("Booking must have a scheduled date and time before completion")
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "garage_bookings"
      SET "status" = 'completed'::"GarageBookingStatus",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing.id}
    `

    await tx.$executeRaw`
      UPDATE "garage_booking_completion_otps"
      SET "consumedAt" = COALESCE("consumedAt", CURRENT_TIMESTAMP)
      WHERE "bookingId" = ${existing.id}
        AND "consumedAt" IS NULL
    `
  })

  await logBusinessActivity({
    businessAccountId: existing.businessAccountId,
    action: "garage_booking.completed_by_admin_override",
    entityType: "garage_booking",
    entityId: existing.id,
    metadata: {
      adminId,
      garageId: existing.garageId,
      customerId: existing.customerId,
      reason,
      evidence,
    },
  })

  await createNotificationsSafely([
    {
      recipientUserId: existing.garageId,
      actorAdminId: adminId,
      type: "booking.completed_by_admin",
      title: "Booking completed by Admin",
      body: `${existing.publicId} was completed after Admin review.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: existing.id,
    },
    {
      recipientUserId: existing.customerId,
      actorAdminId: adminId,
      type: "booking.completed_by_admin",
      title: "Booking marked completed",
      body: `${existing.serviceName} was marked completed after Admin review.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: existing.id,
    },
  ])

  return {
    ...mapAdminGarageBooking(existing),
    status: "completed" as const,
  }
}

export function buildGarageKpis(rows: readonly GarageRecord[]): GarageKpi[] {
  const activeCount = rows.filter((row) => row.status === "Active").length
  const revenue = rows.reduce((total, row) => {
    const amount = Number(row.revenue.replace(/[^0-9.]/g, ""))
    return total + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  return [
    {
      id: "total-garages",
      title: "Total Garages",
      value: String(rows.length),
      icon: Wrench,
      iconTone: "primary",
    },
    {
      id: "active-garages",
      title: "Active Garages",
      value: String(activeCount),
      icon: Users,
      iconTone: "success",
    },
    {
      id: "avg-rating",
      title: "Avg Rating",
      value: "Static",
      icon: Star,
      iconTone: "warning",
    },
    {
      id: "total-revenue",
      title: "Total Revenue",
      value: `AED ${revenue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: TrendingUp,
      iconTone: "info",
    },
  ]
}

export async function updateAdminGarage(id: string, input: GarageAdminUpdateInput) {
  const name = text(input.name)
  const owner = text(input.owner)
  const nextEmail = email(input.email)
  const phone = optionalText(input.phone, 40)
  const address = optionalText(input.address, 240)
  const city = optionalText(input.city, 100)
  const state = optionalText(input.state, 100)
  const country = optionalText(input.country, 100)
  const status = statusFromInput(input.status)
  const ownerParts = splitOwnerName(owner)

  if (!name) throw new Error("Garage name is required")
  if (!owner) throw new Error("Owner name is required")
  await ensureNoActiveBookingsForClosedDays(id, input)

  const updatedCount = await db.$transaction(async (tx) => {
    const count = await tx.$executeRaw`
      UPDATE "users"
      SET "companyName" = ${name},
          "firstName" = ${ownerParts.firstName},
          "lastName" = ${ownerParts.lastName},
          "email" = ${nextEmail},
          "phone" = ${phone},
          "addressLine1" = ${address},
          "city" = ${city},
          "state" = ${state},
          "country" = ${country},
          "isActive" = ${status !== "Suspended"},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND ('Garage'::"UserRole" = ANY("roles") OR "activeRole" = 'Garage'::"UserRole")
    `

    if (count === 0) return count

    await tx.$executeRaw`
      INSERT INTO "garage_profiles" (
        "id",
        "garageId",
        "contactEmail",
        "mobile",
        "address",
        "city",
        "state",
        "country",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${id},
        ${nextEmail},
        ${phone},
        ${address},
        ${city},
        ${state},
        ${country},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("garageId") DO UPDATE SET
        "contactEmail" = EXCLUDED."contactEmail",
        "mobile" = EXCLUDED."mobile",
        "address" = EXCLUDED."address",
        "city" = EXCLUDED."city",
        "state" = EXCLUDED."state",
        "country" = EXCLUDED."country",
        "updatedAt" = CURRENT_TIMESTAMP
    `

    return count
  })

  if (updatedCount === 0) throw new Error("Garage not found")
  const updated = (await listAdminGarages()).find((row) => row.internalId === id)
  if (!updated) throw new Error("Garage not found")
  return updated
}

export async function deleteAdminGarage(id: string) {
  const count = await db.$executeRaw`
    DELETE FROM "users"
    WHERE "id" = ${id}
      AND ('Garage'::"UserRole" = ANY("roles") OR "activeRole" = 'Garage'::"UserRole")
  `

  if (count === 0) throw new Error("Garage not found")
  return { deleted: true }
}
