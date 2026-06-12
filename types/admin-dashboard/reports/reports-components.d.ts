import type { MiniRow, ReportIcon } from "@/types/admin-dashboard/reports/reports-data"

export type MiniCardConfig = {
  icon: ReportIcon
  iconClass: string
  title: string
  rows: readonly MiniRow[]
}
