import { TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { DashboardKpiCardProps } from "@/types/dashboard/kpi-card"

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  trend,
  trendLabel,
  trendColorClassName,
  className,
}: DashboardKpiCardProps) {
  return (
    <Card className={`dashboard-kpi-card ${className ?? ""}`}>
      <CardContent className="dashboard-kpi-card-content">
        <div className="dashboard-kpi-head">
          <Icon className={`dashboard-icon ${iconClassName ?? "text-dashboard-accent"}`} />
          <span className="dashboard-kpi-title">{title}</span>
        </div>
        <div className="dashboard-kpi-value">{value}</div>
        {trend ? (
          <div className="dashboard-kpi-trend">
            <TrendingUp className="dashboard-icon-xs" />
            <span className={trendColorClassName ?? "text-dashboard-muted"}>
              {trend}
            </span>
            {trendLabel ? (
              <span className="text-dashboard-muted">{trendLabel}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
