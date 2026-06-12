import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type DashboardKpiCardProps = {
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconClassName?: string
  trend?: string
  trendLabel?: string
  trendColorClassName?: string
  className?: string
}

export type DashboardKpi = Omit<DashboardKpiCardProps, "className">
