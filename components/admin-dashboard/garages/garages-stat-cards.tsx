import { GaragesCard } from "./garages-card"
import type { GaragesStatCardsProps } from "@/types/admin-dashboard/garages/garages-stat-cards"

export function GaragesStatCards({ items }: GaragesStatCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <GaragesCard
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
