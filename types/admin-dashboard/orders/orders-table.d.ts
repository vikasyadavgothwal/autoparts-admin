import type { OrderRecord, OrdersTableColumn } from "@/types/admin-dashboard/orders/orders-types"

export type OrdersTableProps = {
  rows: readonly OrderRecord[]
  columns: readonly OrdersTableColumn[]
}
