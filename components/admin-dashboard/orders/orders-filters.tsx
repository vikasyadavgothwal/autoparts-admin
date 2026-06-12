import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  OrdersFiltersProps,
  OrdersSelectProps,
} from "@/types/admin-dashboard/orders/orders-filters"

export function OrdersFilters({ statusOptions, buyerTypeOptions }: OrdersFiltersProps) {
  return (
    <div className="dashboard-filter-bar">
      <OrdersSelect
        placeholder={statusOptions[0]?.label ?? "All Status"}
        items={statusOptions}
      />

      <OrdersSelect
        placeholder={buyerTypeOptions[0]?.label ?? "All Buyer Types"}
        items={buyerTypeOptions}
      />

      <Input
        type="date"
        className="dashboard-filter-control md:w-[190px]"
      />

      <Input
        type="text"
        placeholder="Search orders..."
        className="dashboard-filter-control flex-1"
      />
    </div>
  )
}

function OrdersSelect({ placeholder, items }: OrdersSelectProps) {
  return (
    <Select>
      <SelectTrigger className="dashboard-filter-control w-full md:w-[210px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-dashboard-panel-border bg-dashboard-panel-bg text-dashboard-text">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="focus:bg-dashboard-surface-hover focus:text-dashboard-text"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
