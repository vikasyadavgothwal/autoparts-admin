import { OrdersCard } from "./orders-card"
import type { OrdersStatCardsProps } from "@/types/admin-dashboard/orders/orders-stat-cards"

export function OrdersStatCards({ items }: OrdersStatCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <OrdersCard
          key={item.id}
          title={item.title}
          value={item.value}
          icon={item.icon}
          iconTone={item.iconTone}
        />
      ))}
    </section>
  )
}
