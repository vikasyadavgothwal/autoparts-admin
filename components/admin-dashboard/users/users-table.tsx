import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { UserRecord, UsersTableColumn } from "@/types/admin-dashboard/users/users-types"
import type { UsersTableProps } from "@/types/admin-dashboard/users/users-table"

const USER_STATUS_TONES: Record<UserRecord["status"], StatusTone> = {
  Active: "success",
  Suspended: "danger",
}

export function UsersTable({ rows, columns }: UsersTableProps) {
  return (
    <SectionTable columns={columns as readonly SectionTableColumn[]}>
      {rows.map((user) => (
        <tr
          key={user.id}
          className="cursor-pointer border-b border-dashboard-panel-border transition-colors hover:bg-dashboard-surface-hover"
        >
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <span className="font-medium text-dashboard-accent">{user.id}</span>
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{user.name}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{user.email}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <span className="rounded-md bg-dashboard-accent/10 px-2 py-1 text-xs font-medium text-dashboard-accent">
              {user.role}
            </span>
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <span className="text-dashboard-muted">{user.orders}</span>
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <span className="text-dashboard-muted">{user.rfqs}</span>
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{user.joined}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <StatusBadge label={user.status} tone={USER_STATUS_TONES[user.status]} />
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <Button
              size="sm"
              variant="outline"
              className="h-7 bg-dashboard-panel-bg px-4 py-1.5 text-dashboard-text hover:bg-dashboard-accent hover:text-white"
            >
              View
            </Button>
          </td>
        </tr>
      ))}
    </SectionTable>
  )
}
