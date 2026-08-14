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
  GarageServiceInput,
  GarageServiceRecord,
  GarageServiceStatus,
} from "@/types/garage/services"

type GarageServiceRow = {
  id: string
  publicId: string
  garageId: string
  name: string
  category: string
  durationMinutes: number
  price: number
  currency: string
  bookingsCount: number
  ratingAverage: number | string | null
  reviewCount: bigint | number | null
  reviews: Array<{
    id: string
    customerName: string
    rating: number
    comment: string
    garageReply: string | null
    createdAt: string
    updatedAt: string
  }> | null
  status: GarageServiceStatus
  planSuspendedAt: Date | null
  planSuspensionReason: string | null
  createdAt: Date
  updatedAt: Date
}

const VALID_STATUSES = new Set<GarageServiceStatus>(["active", "inactive", "plan_suspended"])

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const requiredText = (value: unknown, label: string, maxLength = 120) => {
  const normalized = text(value)
  if (!normalized) throw new Error(`${label} is required`)
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`)
  }
  return normalized
}

const wholeNumber = (value: unknown, label: string, min = 0, max = 100_000) => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}`)
  }
  return parsed
}

const moneyToCents = (value: unknown, label: string) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
    throw new Error(`${label} must be a non-negative amount`)
  }
  return Math.round(parsed * 100)
}

const serviceStatus = (value: unknown): GarageServiceStatus => {
  const status = text(value).toLowerCase() as GarageServiceStatus
  return VALID_STATUSES.has(status) ? status : "active"
}

const mapService = (row: GarageServiceRow): GarageServiceRecord => ({
  ...row,
  ratingAverage: Number(row.ratingAverage ?? 0),
  reviewCount:
    typeof row.reviewCount === "bigint"
      ? Number(row.reviewCount)
      : row.reviewCount ?? 0,
  reviews: row.reviews ?? [],
  planSuspendedAt: row.planSuspendedAt?.toISOString() ?? null,
  planSuspensionReason: row.planSuspensionReason,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const serviceSelect = Prisma.sql`
  SELECT
    "id",
    "publicId",
    "garageId",
    "name",
    "category",
    "durationMinutes",
    "price",
    "currency",
    "bookingsCount",
    COALESCE(
      (
        SELECT ROUND(AVG(gsr."rating")::numeric, 1)
        FROM "garage_service_reviews" gsr
        WHERE gsr."serviceId" = "garage_services"."id"
      ),
      0
    ) AS "ratingAverage",
    COALESCE(
      (
        SELECT COUNT(*)
        FROM "garage_service_reviews" gsr
        WHERE gsr."serviceId" = "garage_services"."id"
      ),
      0
    ) AS "reviewCount",
    COALESCE(
      (
        SELECT jsonb_agg(review_row ORDER BY review_row->>'createdAt' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', gsr."id",
            'customerName', COALESCE(NULLIF(CONCAT_WS(' ', cu."firstName", cu."lastName"), ''), cu."email", cu."phone", 'Customer'),
            'rating', gsr."rating",
            'comment', gsr."comment",
            'garageReply', gsr."garageReply",
            'createdAt', gsr."createdAt"::text,
            'updatedAt', gsr."updatedAt"::text
          ) AS review_row
          FROM "garage_service_reviews" gsr
          LEFT JOIN "users" cu ON cu."id" = gsr."customerId"
          WHERE gsr."serviceId" = "garage_services"."id"
          ORDER BY gsr."createdAt" DESC
        ) service_reviews
      ),
      '[]'::jsonb
    ) AS "reviews",
    "status",
    "planSuspendedAt",
    "planSuspensionReason",
    "createdAt",
    "updatedAt"
  FROM "garage_services"
`

export async function listGarageServices(garageId: string) {
  const rows = await db.$queryRaw<GarageServiceRow[]>`
    ${serviceSelect}
    WHERE "garageId" = ${garageId}
    ORDER BY "createdAt" DESC
  `
  return rows.map(mapService)
}

export async function listGarageServicesPage(
  garageId: string,
  input: PaginationInput = {},
): Promise<PaginatedResult<GarageServiceRecord>> {
  const { page, pageSize, skip } = pagination(input)
  const [count] = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "garage_services"
    WHERE "garageId" = ${garageId}
  `
  const rows = await db.$queryRaw<GarageServiceRow[]>`
    ${serviceSelect}
    WHERE "garageId" = ${garageId}
    ORDER BY "createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `

  return {
    items: rows.map(mapService),
    pagination: paginationMeta(page, pageSize, count?.total ?? 0),
  }
}

export async function createGarageService(
  garageId: string,
  input: GarageServiceInput,
) {
  const name = requiredText(input.name, "Service name")
  const category = requiredText(input.category, "Category", 80)
  const durationMinutes = wholeNumber(input.durationMinutes, "Duration", 1, 1440)
  const price = moneyToCents(input.price, "Price")
  const currency = (text(input.currency) || "AED").toUpperCase().slice(0, 3)
  const bookingsCount = 0
  const status = serviceStatus(input.status)
  const [service] = await db.$queryRaw<GarageServiceRow[]>`
    INSERT INTO "garage_services" (
      "id",
      "garageId",
      "name",
      "category",
      "durationMinutes",
      "price",
      "currency",
      "bookingsCount",
      "status",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${garageId},
      ${name},
      ${category},
      ${durationMinutes},
      ${price},
      ${currency},
      ${bookingsCount},
      ${status}::"GarageServiceStatus",
      CURRENT_TIMESTAMP
    )
    RETURNING
      "id",
      "publicId",
      "garageId",
      "name",
      "category",
      "durationMinutes",
      "price",
      "currency",
      "bookingsCount",
      0 AS "ratingAverage",
      0 AS "reviewCount",
      '[]'::jsonb AS "reviews",
      "status",
      NULL AS "planSuspendedAt",
      NULL AS "planSuspensionReason",
      "createdAt",
      "updatedAt"
  `
  return mapService(service)
}

export async function updateGarageService(
  garageId: string,
  serviceId: string,
  input: GarageServiceInput,
) {
  const existing = await db.garageService.findFirst({
    where: { id: serviceId, garageId },
    select: { status: true, planSuspensionReason: true },
  })
  if (!existing) throw new Error("Service not found")
  if (existing.status === "plan_suspended") {
    throw new Error(existing.planSuspensionReason || "This service is temporarily inactive because it is over your current plan limit. Upgrade your plan to restore it.")
  }
  const name = requiredText(input.name, "Service name")
  const category = requiredText(input.category, "Category", 80)
  const durationMinutes = wholeNumber(input.durationMinutes, "Duration", 1, 1440)
  const price = moneyToCents(input.price, "Price")
  const currency = (text(input.currency) || "AED").toUpperCase().slice(0, 3)
  const status = serviceStatus(input.status)
  const rows = await db.$queryRaw<GarageServiceRow[]>`
    UPDATE "garage_services"
    SET
      "name" = ${name},
      "category" = ${category},
      "durationMinutes" = ${durationMinutes},
      "price" = ${price},
      "currency" = ${currency},
      "status" = ${status}::"GarageServiceStatus",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${serviceId} AND "garageId" = ${garageId}
    RETURNING
      "id",
      "publicId",
      "garageId",
      "name",
      "category",
      "durationMinutes",
      "price",
      "currency",
      "bookingsCount",
      0 AS "ratingAverage",
      0 AS "reviewCount",
      '[]'::jsonb AS "reviews",
      "status",
      "planSuspendedAt",
      "planSuspensionReason",
      "createdAt",
      "updatedAt"
  `
  if (!rows[0]) throw new Error("Service not found")
  return mapService(rows[0])
}

export async function deleteGarageService(garageId: string, serviceId: string) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    DELETE FROM "garage_services"
    WHERE "id" = ${serviceId} AND "garageId" = ${garageId}
    RETURNING "id"
  `
  if (!rows[0]) throw new Error("Service not found")
  return rows[0]
}
