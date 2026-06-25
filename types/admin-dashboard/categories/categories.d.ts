export type CategoryStatus = "ACTIVE" | "INACTIVE"

export type CategoryInput = {
  name: string
  status: CategoryStatus
}

export type CategoryRecord = {
  id: string
  name: string
  slug: string
  status: CategoryStatus
  linkedPartsCount: number
  createdAt: string
  updatedAt: string
}

export type CategorySearchInput = {
  query?: string
  page?: number
  pageSize?: number
}

export type CategoryPageResult = {
  categories: CategoryRecord[]
  query: string
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export type CategoryActionResult =
  | {
      ok: true
      message: string
    }
  | {
      ok: false
      message: string
    }

export type CategoryFormMode = "create" | "edit"
