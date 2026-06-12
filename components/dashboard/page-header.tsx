import type { DashboardPageHeaderProps } from "@/types/dashboard/page-header"

export function DashboardPageHeader({
  title,
  subtitle,
  action,
}: DashboardPageHeaderProps) {
  return (
    <div className="dashboard-page-header">
      <div>
        <h1 className="dashboard-page-title">{title}</h1>
        <p className="dashboard-page-subtitle">{subtitle}</p>
      </div>
      {action ? <div className="dashboard-page-header-action">{action}</div> : null}
    </div>
  )
}
