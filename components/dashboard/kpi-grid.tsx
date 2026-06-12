import { DashboardKpiCard } from "./kpi-card"
import type { DashboardKpiGridProps } from "@/types/dashboard/kpi-grid"

export function DashboardKpiGrid({ items }: DashboardKpiGridProps) {
  return (
    <section className="dashboard-kpi-grid">
      {items.map((item) => (
        <DashboardKpiCard key={item.title} {...item} />
      ))}
    </section>
  )
}
