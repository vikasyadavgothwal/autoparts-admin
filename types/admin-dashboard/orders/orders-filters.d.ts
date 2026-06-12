import type { OrdersFilterOption } from "@/types/admin-dashboard/orders/orders-types"

export type OrdersFiltersProps = {
  statusOptions: readonly OrdersFilterOption[]
  buyerTypeOptions: readonly OrdersFilterOption[]
}

export type OrdersSelectProps = {
  placeholder: string
  items: readonly OrdersFilterOption[]
}
