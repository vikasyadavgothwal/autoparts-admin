export type VehicleInput = {
  brand: string
  carName: string
  variant?: string | null
  modelYear?: number | null
}

export type VehicleBulkRow = VehicleInput

export type VehicleRecord = {
  id: string
  brand: string
  carName: string
  variant: string | null
  modelYear: number | null
  partCount: number
  createdAt: string
  updatedAt: string
}

export type VehicleSearchInput = {
  query?: string
  page?: number
  pageSize?: number
}

export type VehiclePageResult = {
  vehicles: VehicleRecord[]
  query: string
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export type VehicleActionResult =
  | {
      ok: true
      message: string
      imported?: number
      skipped?: number
    }
  | {
      ok: false
      message: string
    }

export type VehicleFormMode = "create" | "edit"

export type ParsedVehicleSheet = {
  rows: VehicleBulkRow[]
  errors: string[]
}
