import type { ReactNode } from "react"
import type { StatusTone as DashboardStatusTone } from "@/types/dashboard/status-pill"

export type StatusTone = DashboardStatusTone

export type StatusBadgeProps = {
  label: string
  tone: StatusTone
  children?: ReactNode
  className?: string
}
