import type { ReactNode } from "react"

export type StatusTone = "success" | "warning" | "info" | "danger" | "primary" | "neutral"

export type DashboardStatusPillProps = {
  label: string
  tone: StatusTone
  children?: ReactNode
  className?: string
}
