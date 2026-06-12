import type { GarageRecord, GarageTableColumn } from "@/types/admin-dashboard/garages/garages-types"

export type GaragesTableProps = {
  rows: readonly GarageRecord[]
  columns: readonly GarageTableColumn[]
}
