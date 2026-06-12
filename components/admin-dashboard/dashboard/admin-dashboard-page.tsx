import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import {
  DASHBOARD_MAIN_STATS,
  DASHBOARD_SMALL_STATS,
  RFQS,
  RFQ_TABLE_HEADERS,
  ORDERS,
  ORDER_TABLE_HEADERS,
  SUPPLIERS,
  SUPPLIER_TABLE_HEADERS,
  SYSTEM_HEALTH_METRICS,
} from "@/services/admin-dashboard/dashboard/dashboard-data"
import {
  DashboardHealthItem,
  DashboardKpiCards,
  DashboardStatusBadge,
  DashboardTableSection,
} from "./dashboard-components"
import { appRoutes } from "@/lib/routes"

export function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Admin Dashboard"
        subtitle="Platform overview and moderation controls."
      />

      <DashboardKpiCards items={DASHBOARD_MAIN_STATS} />

      <DashboardKpiCards items={DASHBOARD_SMALL_STATS} compact />

      <DashboardTableSection
        title="Pending Supplier Approvals"
        linkText="View All Suppliers"
        linkHref={appRoutes.suppliers}
        headers={SUPPLIER_TABLE_HEADERS}
      >
        {SUPPLIERS.map((supplier) => (
          <tr
            key={supplier.id}
            className="dashboard-table-row cursor-pointer border-[#2A2A2A] transition-colors hover:bg-[#2A2A2A]"
          >
            <td className="dashboard-table-cell px-6 py-4 text-sm">
              <span className="font-medium text-[#DC2626]">{supplier.id}</span>
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.business}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.email}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.location}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.submitted}
            </td>
            <td className="dashboard-table-cell px-6 py-4">
              <Badge
                variant="outline"
                className="rounded-full border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500"
              >
                Pending
              </Badge>
            </td>
            <td className="dashboard-table-cell px-6 py-4">
              <div className="flex gap-2">
                <Button className="h-auto rounded bg-[#DC2626] px-3 py-1 text-xs text-white hover:bg-[#B91C1C]">
                  Approve
                </Button>
                <Button className="h-auto rounded bg-[#2A2A2A] px-3 py-1 text-xs text-white hover:bg-[#3A3A3A]">
                  Reject
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </DashboardTableSection>

      <DashboardTableSection
        title="Recent RFQs"
        linkText="View All"
        linkHref="/rfqs"
        headers={RFQ_TABLE_HEADERS}
      >
        {RFQS.map((rfq) => (
          <tr
            key={rfq.id}
            className="dashboard-table-row cursor-pointer border-[#2A2A2A] transition-colors hover:bg-[#2A2A2A]"
          >
            <td className="dashboard-table-cell px-6 py-4 text-sm">
              <span className="font-medium text-[#DC2626]">{rfq.id}</span>
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {rfq.buyer}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {rfq.part}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {rfq.vehicle}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {rfq.quotes}
            </td>
            <td className="dashboard-table-cell px-6 py-4">
              <DashboardStatusBadge status={rfq.status} />
            </td>
          </tr>
        ))}
      </DashboardTableSection>

      <DashboardTableSection
        title="Recent Orders"
        linkText="View All"
        linkHref="/orders"
        headers={ORDER_TABLE_HEADERS}
      >
        {ORDERS.map((order) => (
          <tr
            key={order.id}
            className="dashboard-table-row cursor-pointer border-[#2A2A2A] transition-colors hover:bg-[#2A2A2A]"
          >
            <td className="dashboard-table-cell px-6 py-4 text-sm">
              <span className="font-medium text-[#DC2626]">{order.id}</span>
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {order.buyer}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {order.supplier}
            </td>
            <td className="dashboard-table-cell px-6 py-4">
              <span className="font-semibold text-white">{order.amount}</span>
            </td>
            <td className="dashboard-table-cell px-6 py-4">
              <DashboardStatusBadge status={order.status} />
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {order.date}
            </td>
          </tr>
        ))}
      </DashboardTableSection>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardContent className="p-6">
          <h2 className="mb-6 text-xl font-bold text-white">System Health</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {SYSTEM_HEALTH_METRICS.map((metric) => (
              <DashboardHealthItem
                key={metric.title}
                title={metric.title}
                value={metric.value}
                note={metric.note}
                red={metric.red}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
