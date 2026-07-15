import { randomUUID } from "node:crypto"

import { Star, TrendingUp, Users, Wrench } from "lucide-react"

import { db } from "@/lib/database/prisma"
import type {
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
  postalCode: string | null
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
  profilePincode: string | null
  bookingsCount: bigint | number
  revenueCents: bigint | number | null
  ratingAverage: number | string | null
  reviewsCount: bigint | number | null
  reviews: GarageServiceReviewRecord[] | null
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
  pincode?: unknown
  status?: unknown
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
  const pincode = row.profilePincode || row.postalCode || ""
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
    pincode,
    rating: row.reviewsCount ? String(Number(row.ratingAverage ?? 0)) : "No reviews",
    reviewsCount: asNumber(row.reviewsCount),
    reviews: row.reviews ?? [],
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
      u."postalCode",
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
      gp."pincode" AS "profilePincode",
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

  return rows.map(mapGarage)
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
  const pincode = optionalText(input.pincode, 30)
  const status = statusFromInput(input.status)
  const ownerParts = splitOwnerName(owner)

  if (!name) throw new Error("Garage name is required")
  if (!owner) throw new Error("Owner name is required")

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
          "postalCode" = ${pincode},
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
        "pincode",
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
        ${pincode},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("garageId") DO UPDATE SET
        "contactEmail" = EXCLUDED."contactEmail",
        "mobile" = EXCLUDED."mobile",
        "address" = EXCLUDED."address",
        "city" = EXCLUDED."city",
        "state" = EXCLUDED."state",
        "country" = EXCLUDED."country",
        "pincode" = EXCLUDED."pincode",
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
