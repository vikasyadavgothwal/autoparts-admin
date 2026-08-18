import { db } from "@/lib/database/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"

export type MarketplaceSearchLogRow = {
  id: string
  searchedNumber: string
  normalizedNumber: string
  resultStatus: string
  resultLabel: string
  queryType: string
  isUnavailable: boolean
  createdAt: Date
}

export type MarketplaceSearchChartRow = {
  name: string
  value: number
}

export type MarketplaceSearchTrendRow = {
  date: string
  searches: number
}

export type MarketplaceSearchTablePage = {
  rows: MarketplaceSearchLogRow[]
  page: number
  pageCount: number
  total: number
}

type MarketplaceSearchAnalyticsInput = {
  page?: number
  pageSize?: number
  query?: string | null
  queryType?: string | null
  status?: string | null
}

const DEFAULT_PAGE_SIZE = 10
const CHART_SOURCE_LIMIT = 5000
const QUERY_TYPE_OPTIONS = new Set(["vin", "part_number", "part_name"])
const STATUS_OPTIONS = new Set(["available", "unavailable"])

const clampPage = (page: number | undefined, total: number, pageSize: number) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Number.isFinite(page) ? Math.trunc(page ?? 1) : 1

  return Math.min(Math.max(safePage, 1), pageCount)
}

const formatQueryType = (resultStatus: string) =>
  resultStatus
    .replace(/_(available|unavailable)$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatResultLabel = (resultStatus: string) =>
  resultStatus.endsWith("_unavailable") ? "Not available" : "Available"

const toLogRow = (row: {
  id: string
  searchedNumber: string
  normalizedNumber: string
  resultStatus: string
  createdAt: Date
}): MarketplaceSearchLogRow => ({
  ...row,
  resultLabel: formatResultLabel(row.resultStatus),
  queryType: formatQueryType(row.resultStatus),
  isUnavailable: row.resultStatus.endsWith("_unavailable"),
})

const normalizeQueryType = (value: string | null | undefined) =>
  value && QUERY_TYPE_OPTIONS.has(value) ? value : ""

const normalizeStatus = (value: string | null | undefined) =>
  value && STATUS_OPTIONS.has(value) ? value : ""

const buildWhere = (
  input: MarketplaceSearchAnalyticsInput,
): Prisma.UnmatchedPartSearchLogWhereInput => {
  const query = input.query?.trim()
  const queryType = normalizeQueryType(input.queryType)
  const status = normalizeStatus(input.status)
  const filters: Prisma.UnmatchedPartSearchLogWhereInput[] = []

  if (query) {
    filters.push({
      OR: [
        { searchedNumber: { contains: query, mode: "insensitive" } },
        { normalizedNumber: { contains: query, mode: "insensitive" } },
      ],
    })
  }

  if (queryType) {
    filters.push({ resultStatus: { startsWith: `${queryType}_` } })
  }

  if (status) {
    filters.push({ resultStatus: { endsWith: `_${status}` } })
  }

  return filters.length ? { AND: filters } : {}
}

const increment = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) ?? 0) + 1)
}

const mapToChartRows = (map: Map<string, number>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))

export async function getMarketplaceSearchAnalytics(
  input: MarketplaceSearchAnalyticsInput = {},
) {
  const pageSize = Math.min(Math.max(input.pageSize ?? DEFAULT_PAGE_SIZE, 5), 50)
  const where = buildWhere(input)
  const total = await db.unmatchedPartSearchLog.count({ where })
  const page = clampPage(input.page, total, pageSize)
  const [rows, chartLogs, unavailable] = await Promise.all([
    db.unmatchedPartSearchLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.unmatchedPartSearchLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: CHART_SOURCE_LIMIT,
    }),
    db.unmatchedPartSearchLog.count({
      where: { AND: [where, { resultStatus: { endsWith: "_unavailable" } }] },
    }),
  ])
  const typeCounts = new Map<string, number>()
  const statusCounts = new Map<string, number>()
  const trendCounts = new Map<string, number>()

  for (const log of chartLogs) {
    const row = toLogRow(log)
    const date = log.createdAt.toISOString().slice(0, 10)
    increment(typeCounts, row.queryType)
    increment(statusCounts, row.resultLabel)
    increment(trendCounts, date)
  }

  return {
    total,
    available: total - unavailable,
    unavailable,
    filters: {
      query: input.query?.trim() ?? "",
      queryType: normalizeQueryType(input.queryType),
      status: normalizeStatus(input.status),
    },
    typeChart: mapToChartRows(typeCounts),
    statusChart: mapToChartRows(statusCounts),
    trendChart: Array.from(trendCounts.entries())
      .map(([date, searches]) => ({ date, searches }))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-14),
    table: {
      rows: rows.map((row) => toLogRow(row)),
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  }
}
