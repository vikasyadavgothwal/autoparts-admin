import type { SupplierRecord, SupplierTableColumn } from "@/types/admin-dashboard/suppliers/suppliers-types"

export type SupplierTableProps = {
  rows: readonly SupplierRecord[]
  columns: readonly SupplierTableColumn[]
}
