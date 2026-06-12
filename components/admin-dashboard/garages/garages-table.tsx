import { MapPin, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { GaragesTableProps } from "@/types/admin-dashboard/garages/garages-table"

const GARAGE_STATUS_TONES: Record<string, StatusTone> = {
  Active: "success",
  Pending: "warning",
  Suspended: "danger",
}

export function GaragesTable({ rows, columns }: GaragesTableProps) {
  return (
    <SectionTable columns={columns as readonly SectionTableColumn[]}>
      {rows.map((garage) => (
        <tr
          key={garage.id}
          className="dashboard-table-row"
        >
          <td className="dashboard-table-cell">
            <span className="font-medium text-dashboard-accent">{garage.id}</span>
          </td>
          <td className="dashboard-table-cell">
            <div>
              <div className="flex items-center gap-2 font-medium text-dashboard-text">
                {garage.name}
                {garage.verified ? (
                  <span className="text-dashboard-info">✓</span>
                ) : null}
              </div>
              <div className="text-sm text-dashboard-muted">
                {garage.owner}
              </div>
            </div>
          </td>
          <td className="dashboard-table-cell">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-dashboard-muted" />
              <span className="text-dashboard-text">{garage.location}</span>
            </div>
          </td>
          <td className="dashboard-table-cell">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-dashboard-warning text-dashboard-warning" />
              <span className="font-medium text-dashboard-text">
                {garage.rating}
              </span>
            </div>
          </td>
          <td className="dashboard-table-cell text-dashboard-muted">
            {garage.bookings}
          </td>
          <td className="dashboard-table-cell">
            <span className="font-medium text-dashboard-text">
              {garage.revenue}
            </span>
          </td>
          <td className="dashboard-table-cell text-dashboard-muted">
            {garage.joinDate}
          </td>
          <td className="dashboard-table-cell">
            <StatusBadge
              label={garage.status}
              tone={GARAGE_STATUS_TONES[garage.status] ?? "warning"}
            />
          </td>
          <td className="dashboard-table-cell">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-dashboard-panel-border hover:bg-dashboard-accent hover:text-white"
              >
                View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-dashboard-panel-border hover:bg-dashboard-info/10 hover:text-dashboard-info"
              >
                Edit
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </SectionTable>
  )
}
