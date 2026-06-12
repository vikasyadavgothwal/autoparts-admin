
import {
  DashboardStatusPill,
} from "@/components/dashboard/status-pill"
import type {
  StatusBadgeProps,
} from "@/types/admin-dashboard/shared/status-badge"

export function StatusBadge({
  label,
  tone,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <DashboardStatusPill label={label} tone={tone} className={className}>
      {children ?? label}
    </DashboardStatusPill>
  )
}
