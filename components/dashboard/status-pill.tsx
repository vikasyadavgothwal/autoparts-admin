import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  DashboardStatusPillProps,
  StatusTone,
} from "@/types/dashboard/status-pill"

const dashboardStatusToneClass: Record<StatusTone, string> = {
  success: "dashboard-status-pill-success",
  warning: "dashboard-status-pill-warning",
  info: "dashboard-status-pill-info",
  danger: "dashboard-status-pill-danger",
  primary: "dashboard-status-pill-primary",
  neutral: "dashboard-status-pill-neutral",
}

export function DashboardStatusPill({
  label,
  tone,
  children,
  className,
}: DashboardStatusPillProps) {
  return (
    <Badge className={cn("dashboard-status-pill", dashboardStatusToneClass[tone], className)}>
      {children ?? label}
    </Badge>
  )
}
