import { SuppliersCard } from "./suppliers-card"
import type { SuppliersStatCardsProps } from "@/types/admin-dashboard/suppliers/suppliers-stat-cards"

export function SuppliersStatCards({ items }: SuppliersStatCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <SuppliersCard
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
