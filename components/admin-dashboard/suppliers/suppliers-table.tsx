import { Button } from "@/components/ui/button"
import { Check, CircleX } from "lucide-react"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { SupplierRecord, SupplierStatus, SupplierTableColumn } from "@/types/admin-dashboard/suppliers/suppliers-types"
import type { SupplierTableProps } from "@/types/admin-dashboard/suppliers/suppliers-table"

const SUPPLIER_STATUS_TONES: Record<SupplierStatus, StatusTone> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
}

export function SuppliersTable({ rows, columns }: SupplierTableProps) {
  return (
    <SectionTable columns={columns as readonly SectionTableColumn[]}>
      {rows.map((supplier) => (
        <tr key={supplier.id} className="cursor-pointer border-b border-dashboard-panel-border transition-colors hover:bg-dashboard-surface-hover">
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <span className="font-medium text-dashboard-accent">{supplier.id}</span>
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.name}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.email}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.phone}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.products}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.rating}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">{supplier.joined}</td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            <StatusBadge label={supplier.status} tone={SUPPLIER_STATUS_TONES[supplier.status]} />
          </td>
          <td className="px-6 py-4 text-sm text-dashboard-muted">
            {supplier.status === "Pending" ? (
              <div className="flex gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Approve supplier"
                  className="border-dashboard-success/30 hover:bg-dashboard-success/10 hover:text-dashboard-success"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Reject supplier"
                  className="border-dashboard-danger/30 hover:bg-dashboard-danger/10 hover:text-dashboard-danger"
                >
                  <CircleX className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-dashboard-muted border-dashboard-panel-border hover:bg-dashboard-surface-hover hover:text-dashboard-text"
              >
                View
              </Button>
            )}
          </td>
        </tr>
      ))}
    </SectionTable>
  )
}
