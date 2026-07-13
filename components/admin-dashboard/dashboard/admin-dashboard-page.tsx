import Link from "next/link"

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
import { listAdminSuppliers } from "@/services/admin-dashboard/suppliers/supplier-management-service"

export async function AdminDashboardPage() {
  const suppliers = await listAdminSuppliers()
  const allPendingSuppliers = suppliers.filter(
    (supplier) => supplier.status === "Pending",
  )
  const pendingSuppliers = allPendingSuppliers.slice(0, 5)
  const dashboardSmallStats = DASHBOARD_SMALL_STATS.map((stat) =>
    stat.title === "Suppliers"
      ? {
          ...stat,
          value: String(suppliers.length),
          note: `${allPendingSuppliers.length} pending approval${allPendingSuppliers.length === 1 ? "" : "s"}`,
        }
      : stat,
  )

  return (
    <div className="space-y-8">
      <PageHeading
        title="Admin Dashboard"
        subtitle="Platform overview and moderation controls."
      />

      <DashboardKpiCards items={DASHBOARD_MAIN_STATS} />

      <DashboardKpiCards items={dashboardSmallStats} compact />

      <DashboardTableSection
        title="Pending Supplier Approvals"
        linkText="View All Suppliers"
        linkHref={appRoutes.supplier}
        headers={SUPPLIER_TABLE_HEADERS}
      >
        {pendingSuppliers.length === 0 ? (
          <tr className="dashboard-table-row">
            <td
              className="dashboard-table-cell px-6 py-6 text-center text-sm text-dashboard-muted"
              colSpan={SUPPLIER_TABLE_HEADERS.length}
            >
              No supplier applications are waiting for review.
            </td>
          </tr>
        ) : null}
        {pendingSuppliers.map((supplier) => (
          <tr
            key={supplier.id}
            className="dashboard-table-row cursor-pointer border-[#2A2A2A] transition-colors hover:bg-[#2A2A2A]"
          >
            <td className="dashboard-table-cell px-6 py-4 text-sm">
              <span className="font-medium text-[#DC2626]">{supplier.id}</span>
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.name}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.email}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {[supplier.city, supplier.state, supplier.country]
                .filter((value) => value !== "Not added")
                .join(", ") || "Not added"}
            </td>
            <td className="dashboard-table-cell px-6 py-4 text-sm text-[#9CA3AF]">
              {supplier.joined}
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
              <Button asChild size="sm">
                <Link href={appRoutes.supplier}>Review</Link>
              </Button>
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
