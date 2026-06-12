import type { ReactNode } from "react"
import type { DashboardStat } from "@/types/admin-dashboard/dashboard/dashboard-data"

export type DashboardKpiCardsProps = {
  items: readonly DashboardStat[]
  compact?: boolean
}

export type DashboardTableSectionProps = {
  title: string
  linkText: string
  linkHref: string
  headers: readonly string[]
  children: ReactNode
}

export type DashboardStatusBadgeProps = {
  status: string
}

export type DashboardHealthItemProps = {
  title: string
  value: string
  note: string
  red?: boolean
}
