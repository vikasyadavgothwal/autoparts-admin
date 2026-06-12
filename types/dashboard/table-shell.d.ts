import type { ReactNode } from "react"

export type DashboardTableColumn = {
  key: string
  label: string
  className?: string
}

export type DashboardTableShellProps = {
  columns: readonly DashboardTableColumn[]
  children: ReactNode
}
