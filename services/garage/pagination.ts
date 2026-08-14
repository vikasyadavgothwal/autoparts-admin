export type PaginationInput = {
  page?: unknown
  pageSize?: unknown
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type PaginatedResult<T> = {
  items: T[]
  pagination: PaginationMeta
}

export function pagination(input: PaginationInput = {}) {
  const page = Math.max(1, Number.parseInt(String(input.page ?? "1"), 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(input.pageSize ?? "10"), 10) || 10),
  )

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  }
}

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
