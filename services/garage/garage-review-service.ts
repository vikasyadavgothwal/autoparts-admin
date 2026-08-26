import { randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import {
  pagination,
  paginationMeta,
  type PaginatedResult,
  type PaginationInput,
} from "@/services/garage/pagination"
import type {
  GarageReviewReplyInput,
  GarageServiceReviewInput,
  GarageServiceReviewRecord,
} from "@/types/garage/reviews"

type ReviewRow = {
  id: string
  garageId: string
  serviceId: string
  customerId: string
  bookingId: string | null
  serviceName: string
  customerName: string
  rating: number
  comment: string
  garageReply: string | null
  garageReplyAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type BookingReviewSource = {
  id: string
  garageId: string
  serviceId: string
  serviceName: string
}

const text = (value: unknown, maxLength = 1000) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  if (!normalized) return ""
  return normalized.slice(0, maxLength)
}

const requiredText = (value: unknown, label: string, maxLength = 1000) => {
  const normalized = text(value, maxLength)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

const rating = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Rating must be between 1 and 5")
  }
  return parsed
}

const mapReview = (row: ReviewRow): GarageServiceReviewRecord => ({
  ...row,
  garageReplyAt: row.garageReplyAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const reviewSelect = Prisma.sql`
  SELECT
    r."id",
    r."garageId",
    r."serviceId",
    r."customerId",
    r."bookingId",
    COALESCE(gs."name", gb."serviceName", 'Service') AS "serviceName",
    COALESCE(
      NULLIF(CONCAT_WS(' ', u."firstName", u."lastName"), ''),
      gb."customerName",
      'Customer'
    ) AS "customerName",
    r."rating",
    r."comment",
    r."garageReply",
    r."garageReplyAt",
    r."createdAt",
    r."updatedAt"
  FROM "garage_service_reviews" r
  LEFT JOIN "garage_services" gs ON gs."id" = r."serviceId"
  LEFT JOIN "garage_bookings" gb ON gb."id" = r."bookingId"
  LEFT JOIN "users" u ON u."id" = r."customerId"
`

async function findCompletedReviewableBooking(
  customerId: string,
  serviceId: string,
  bookingId?: string,
) {
  const idCondition = bookingId
    ? Prisma.sql`AND (gb."id" = ${bookingId} OR gb."publicId" = ${bookingId})`
    : Prisma.empty

  const [booking] = await db.$queryRaw<BookingReviewSource[]>`
    SELECT gb."id", gb."garageId", gb."serviceId", gb."serviceName"
    FROM "garage_bookings" gb
    WHERE gb."customerId" = ${customerId}
      AND gb."serviceId" = ${serviceId}
      AND gb."status" = 'completed'::"GarageBookingStatus"
      ${idCondition}
    ORDER BY gb."createdAt" DESC
    LIMIT 1
  `

  return booking ?? null
}

export async function upsertUserGarageServiceReview(
  customerId: string,
  input: GarageServiceReviewInput,
) {
  const serviceId = requiredText(input.serviceId, "Service", 120)
  const bookingId = text(input.bookingId, 120) || undefined
  const nextRating = rating(input.rating)
  const comment = requiredText(input.comment, "Review comment", 1000)
  const booking = await findCompletedReviewableBooking(
    customerId,
    serviceId,
    bookingId,
  )

  if (!booking) {
    throw new Error("Only completed bookings for this service can be reviewed")
  }

  const [review] = await db.$queryRaw<ReviewRow[]>`
    INSERT INTO "garage_service_reviews" (
      "id",
      "garageId",
      "serviceId",
      "customerId",
      "bookingId",
      "rating",
      "comment",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${booking.garageId},
      ${booking.serviceId},
      ${customerId},
      ${booking.id},
      ${nextRating},
      ${comment},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("bookingId") DO UPDATE SET
      "garageId" = EXCLUDED."garageId",
      "serviceId" = EXCLUDED."serviceId",
      "customerId" = EXCLUDED."customerId",
      "rating" = EXCLUDED."rating",
      "comment" = EXCLUDED."comment",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "id",
      "garageId",
      "serviceId",
      "customerId",
      "bookingId",
      ${booking.serviceName} AS "serviceName",
      'You' AS "customerName",
      "rating",
      "comment",
      "garageReply",
      "garageReplyAt",
      "createdAt",
      "updatedAt"
  `

  return mapReview(review)
}

export async function listGarageServiceReviews(garageId: string) {
  const rows = await db.$queryRaw<ReviewRow[]>`
    ${reviewSelect}
    WHERE r."garageId" = ${garageId}
    ORDER BY r."createdAt" DESC
  `
  return rows.map(mapReview)
}

export async function listGarageServiceReviewsPage(
  garageId: string,
  input: PaginationInput = {},
): Promise<PaginatedResult<GarageServiceReviewRecord>> {
  const { page, pageSize, skip } = pagination(input)
  const [count] = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "garage_service_reviews" r
    WHERE r."garageId" = ${garageId}
  `
  const rows = await db.$queryRaw<ReviewRow[]>`
    ${reviewSelect}
    WHERE r."garageId" = ${garageId}
    ORDER BY r."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `

  return {
    items: rows.map(mapReview),
    pagination: paginationMeta(page, pageSize, count?.total ?? 0),
  }
}

export async function updateGarageServiceReviewReply(
  garageId: string,
  reviewId: string,
  input: GarageReviewReplyInput,
) {
  const reply = requiredText(input.reply, "Reply", 1000)
  const count = await db.$executeRaw`
    UPDATE "garage_service_reviews"
    SET "garageReply" = ${reply},
        "garageReplyAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${reviewId}
      AND "garageId" = ${garageId}
  `

  if (count === 0) throw new Error("Review not found")

  const [review] = await db.$queryRaw<ReviewRow[]>`
    ${reviewSelect}
    WHERE r."id" = ${reviewId}
      AND r."garageId" = ${garageId}
    LIMIT 1
  `

  if (!review) throw new Error("Review not found")
  return mapReview(review)
}

export async function listAdminGarageReviews(garageId: string) {
  const rows = await db.$queryRaw<ReviewRow[]>`
    ${reviewSelect}
    WHERE r."garageId" = ${garageId}
    ORDER BY r."createdAt" DESC
  `
  return rows.map(mapReview)
}
