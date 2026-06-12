import { UsersCard } from "./users-card"
import type { UsersStatCardsProps } from "@/types/admin-dashboard/users/users-stat-cards"

export function UsersStatCards({ items }: UsersStatCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <UsersCard
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
