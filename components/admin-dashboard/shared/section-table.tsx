import type { SectionTableProps } from "@/types/admin-dashboard/shared/section-table"

export function SectionTable({ columns, children }: SectionTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dashboard-panel-border bg-dashboard-page-bg">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-left text-sm font-semibold text-dashboard-muted ${column.className ?? ""}`.trim()}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}
