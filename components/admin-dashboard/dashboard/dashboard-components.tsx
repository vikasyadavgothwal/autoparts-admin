import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type {
  DashboardHealthItemProps,
  DashboardKpiCardsProps,
  DashboardStatusBadgeProps,
  DashboardTableSectionProps,
} from "@/types/admin-dashboard/dashboard/dashboard-components"

export function DashboardKpiCards({
  items,
  compact = false,
}: DashboardKpiCardsProps) {
  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 gap-4 md:grid-cols-3"
          : "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
      }
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <Card
            key={item.title}
            className={
              compact
                ? "rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0"
                : "rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0 transition-all hover:border-[#DC2626]"
            }
          >
            <CardContent className="p-6">
              <div
                className={
                  compact
                    ? "mb-4 flex items-center gap-3"
                    : "mb-4 flex items-start justify-between"
                }
              >
                <div
                  className={
                    compact
                      ? "text-sm text-[#9CA3AF]"
                      : "text-sm font-medium text-[#9CA3AF]"
                  }
                >
                  {item.title}
                </div>
                <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/10 p-2">
                  <Icon className="h-5 w-5 text-[#DC2626]" />
                </div>
              </div>

              <div
                className={
                  compact
                    ? "mb-1 text-2xl font-bold text-white"
                    : "mb-2 text-3xl font-bold text-white"
                }
              >
                {item.value}
              </div>

              <div
                className={
                  compact
                    ? item.red
                      ? "text-sm text-[#DC2626]"
                      : "text-sm text-[#9CA3AF]"
                    : "text-sm text-[#DC2626]"
                }
              >
                {item.note}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function DashboardTableSection({
  title,
  linkText,
  linkHref,
  headers,
  children,
}: DashboardTableSectionProps) {
  const columns: readonly SectionTableColumn[] = headers.map((header, index) => ({
    key: `${title}-${index}`,
    label: header,
  }))

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <Link
          href={linkHref}
          className="text-sm font-medium text-[#DC2626] transition-colors hover:text-[#B91C1C]"
        >
          {linkText}
        </Link>
      </div>

      <SectionTable columns={columns}>{children}</SectionTable>
    </section>
  )
}

const STATUS_TONES: Record<string, StatusTone> = {
  Completed: "success",
  "In Transit": "info",
  Active: "success",
  Pending: "warning",
}

export function DashboardStatusBadge({ status }: DashboardStatusBadgeProps) {
  return (
    <StatusBadge
      label={status}
      tone={STATUS_TONES[status] ?? "warning"}
    />
  )
}

export function DashboardHealthItem({
  title,
  value,
  note,
  red,
}: DashboardHealthItemProps) {
  return (
    <div>
      <div className="mb-2 text-sm text-[#9CA3AF]">{title}</div>
      <div className="mb-1 text-2xl font-bold text-white">{value}</div>
      <div className={red ? "text-sm text-[#DC2626]" : "text-sm text-[#9CA3AF]"}>
        {note}
      </div>
    </div>
  )
}
