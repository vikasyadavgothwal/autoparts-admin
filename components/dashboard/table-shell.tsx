import { Card } from "@/components/ui/card"
import type { DashboardTableShellProps } from "@/types/dashboard/table-shell"
import type { ThHTMLAttributes } from "react"
export function DashboardTableShell({ columns, children }: DashboardTableShellProps) {
  return (
    <Card className="dashboard-table-panel">
      <div className="dashboard-overflow-wrap">
        <table className="dashboard-data-table min-w-[980px]">
          <thead>
            <tr>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={`dashboard-table-head ${column.className ?? ""}`}
              >
                {column.label}
              </TableHead>
            ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  )
}

function TableHead({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  )
}
