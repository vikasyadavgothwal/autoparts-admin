"use client"

import {
  DistributionCharts,
  GrowthOverviewCard,
  ReportActionGrid,
  ReportMiniCards,
  ReportsHeader,
  ReportsMetricCards,
} from "./reports-components"

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <ReportsHeader />
      <ReportsMetricCards />
      <GrowthOverviewCard />
      <DistributionCharts />
      <ReportMiniCards />
      <ReportActionGrid />
    </div>
  )
}
