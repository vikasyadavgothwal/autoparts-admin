import type { DashboardFilterBarProps } from "@/types/dashboard/filter-bar"

export function DashboardFilterBar({ children }: DashboardFilterBarProps) {
  return <div className="dashboard-filter-bar">{children}</div>
}
