import type { UsersSectionProps } from "@/types/admin-dashboard/dashboard-sections"

export function UsersSection({ items }: UsersSectionProps) {
  return (
    <section className="rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg p-6">
      <h3 className="mb-4 font-semibold text-dashboard-text">Recent User Activity</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.user}-${item.time}`}
            className="flex items-center justify-between rounded-lg bg-dashboard-page-bg p-3"
          >
            <div>
              <div className="font-medium text-dashboard-text">{item.user}</div>
              <div className="text-sm text-dashboard-muted">{item.action}</div>
            </div>
            <div className="text-xs text-dashboard-muted">{item.time}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
