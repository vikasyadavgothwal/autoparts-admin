import { createHash } from "node:crypto"

import { db } from "@/lib/database/prisma"
import {
  BusinessQueryStatus,
  BusinessQueryType,
  Prisma,
} from "@/lib/generated/prisma/client"
import type {
  BusinessQueryInput,
  BusinessQueryListParams,
  BusinessQueryRecord,
} from "@/types/business-queries/business-queries"

const VALID_TYPES = new Set<string>(Object.values(BusinessQueryType))
const VALID_STATUSES = new Set<string>(Object.values(BusinessQueryStatus))
const PAGE_SIZES = [50, 100, 250, 500, 1000] as const
const MESSAGE_LIMIT = 1500
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const limitedText = (value: unknown, limit: number) => text(value).slice(0, limit)

export const normalizeBusinessQueryPhone = (value: unknown) => {
  const raw = text(value)
  const compact = raw.replace(/[\s().-]/g, "")
  const international = compact.startsWith("+") ? compact : `+${compact}`
  return PHONE_PATTERN.test(international) ? international : null
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const toQueryType = (value: unknown): BusinessQueryType => {
  const raw = text(value)
  if (VALID_TYPES.has(raw)) return raw as BusinessQueryType

  const normalized = raw.toLowerCase()
  if (normalized.includes("fleet")) return BusinessQueryType.FleetDemo
  if (normalized.includes("schedule")) return BusinessQueryType.ScheduleDemo
  if (normalized.includes("book")) return BusinessQueryType.BookDemo
  if (normalized.includes("sale")) return BusinessQueryType.Sales
  if (normalized.includes("contact")) return BusinessQueryType.Contact
  return BusinessQueryType.General
}

const normalizePage = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? "1"), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const normalizePageSize = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? "500"), 10)
  if (PAGE_SIZES.includes(parsed as (typeof PAGE_SIZES)[number])) return parsed
  return 500
}

const optionalEnum = <T extends string>(
  value: unknown,
  allowed: Set<string>,
): T | undefined => {
  const raw = text(value)
  return allowed.has(raw) ? (raw as T) : undefined
}

const hashIp = (value: string | null) =>
  value
    ? createHash("sha256").update(value).digest("hex").slice(0, 64)
    : null

const mapQuery = (query: {
  id: string
  publicId: string
  type: BusinessQueryType
  source: string
  name: string
  email: string
  phone: string | null
  company: string
  message: string | null
  pagePath: string | null
  userAgent: string | null
  status: BusinessQueryStatus
  createdAt: Date
  updatedAt: Date
}): BusinessQueryRecord => ({
  id: query.id,
  publicId: query.publicId,
  type: query.type,
  source: query.source,
  name: query.name,
  email: query.email,
  phone: query.phone,
  company: query.company,
  message: query.message,
  pagePath: query.pagePath,
  userAgent: query.userAgent,
  status: query.status,
  createdAt: query.createdAt.toISOString(),
  updatedAt: query.updatedAt.toISOString(),
})

const searchWhere = (search: string): Prisma.BusinessQueryWhereInput => {
  const query = search.trim()
  if (!query) return {}

  return {
    OR: [
      { publicId: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { company: { contains: query, mode: "insensitive" } },
      { source: { contains: query, mode: "insensitive" } },
      { message: { contains: query, mode: "insensitive" } },
    ],
  }
}

export async function createBusinessQuery(input: BusinessQueryInput) {
  const name = limitedText(input.name, 120)
  const email = limitedText(input.email, 180).toLowerCase()
  const phone = normalizeBusinessQueryPhone(input.phone)
  const company = limitedText(input.company, 160)
  const message = text(input.message)
  const source = limitedText(input.source, 120) || "Business page"
  const pagePath = limitedText(input.pagePath, 260)
  const userAgent = limitedText(input.userAgent, 260)
  const type = toQueryType(input.type ?? source)

  if (name.length < 2) throw new Error("Name must be at least 2 characters")
  if (!emailPattern.test(email)) throw new Error("A valid email is required")
  if (!phone) throw new Error("Enter a valid international phone number with country code")
  if (company.length < 2) throw new Error("Company must be at least 2 characters")
  if (message.length < 5) throw new Error("Message must be at least 5 characters")
  if (message.length > MESSAGE_LIMIT) {
    throw new Error(`Message must be ${MESSAGE_LIMIT} characters or less`)
  }

  const query = await db.businessQuery.create({
    data: {
      type,
      source,
      name,
      email,
      phone,
      company,
      message,
      pagePath: pagePath || null,
      userAgent: userAgent || null,
      ipHash: text(input.ipHash) || null,
    },
  })

  return mapQuery(query)
}

export function businessQueryIpHash(ip: string | null) {
  return hashIp(ip)
}

export async function deleteBusinessQuery(id: string) {
  const queryId = text(id)
  if (!queryId) throw new Error("Query id is required")

  const existing = await db.businessQuery.findUnique({
    where: { id: queryId },
    select: { id: true, publicId: true },
  })

  if (!existing) throw new Error("Query not found")

  await db.businessQuery.delete({ where: { id: queryId } })

  return existing
}

export async function listBusinessQueries(params: BusinessQueryListParams) {
  const page = normalizePage(params.page)
  const pageSize = normalizePageSize(params.pageSize)
  const status = optionalEnum<BusinessQueryStatus>(params.status, VALID_STATUSES)
  const type = optionalEnum<BusinessQueryType>(params.type, VALID_TYPES)
  const where: Prisma.BusinessQueryWhereInput = {
    AND: [
      searchWhere(params.search ?? ""),
      status ? { status } : {},
      type ? { type } : {},
    ],
  }

  const [queries, total, statuses, types] = await Promise.all([
    db.businessQuery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.businessQuery.count({ where }),
    db.businessQuery.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    db.businessQuery.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
  ])

  const byStatus = Object.fromEntries(
    statuses.map((item) => [item.status, item._count._all]),
  )

  return {
    queries: queries.map(mapQuery),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: {
      total,
      newCount: byStatus[BusinessQueryStatus.New] ?? 0,
      reviewedCount: byStatus[BusinessQueryStatus.Reviewed] ?? 0,
      archivedCount: byStatus[BusinessQueryStatus.Archived] ?? 0,
      byType: Object.fromEntries(types.map((item) => [item.type, item._count._all])),
    },
  }
}
