import type { BusinessQueryStatus, BusinessQueryType } from "@/lib/generated/prisma/client"

export type BusinessQueryInput = {
  type?: unknown
  source?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  company?: unknown
  message?: unknown
  pagePath?: unknown
  userAgent?: unknown
  ipHash?: unknown
}

export type BusinessQueryRecord = {
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
  createdAt: string
  updatedAt: string
}

export type BusinessQueryPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type BusinessQuerySummary = {
  total: number
  newCount: number
  reviewedCount: number
  archivedCount: number
  byType: Record<string, number>
}

export type BusinessQueryListResult = {
  queries: BusinessQueryRecord[]
  pagination: BusinessQueryPagination
  summary: BusinessQuerySummary
}

export type BusinessQueryListParams = {
  page?: number
  pageSize?: number
  search?: string
  type?: string
  status?: string
}
