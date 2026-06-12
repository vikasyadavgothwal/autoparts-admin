import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type {  OrderStatus } from "@/types/admin-dashboard/orders/orders-types"
import type { OrdersTableProps } from "@/types/admin-dashboard/orders/orders-table"

const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  Delivered: "success",
  Processing: "warning",
  Shipped: "info",
  Cancelled: "danger",
}

export function OrdersTable({ rows, columns }: OrdersTableProps) {
  return (
    <SectionTable columns={columns as readonly SectionTableColumn[]}>
      {rows.map((order) => (
        <tr
          key={order.id}
          className="dashboard-table-row"
        >
          <td className="dashboard-table-cell">
            <span className="font-medium text-dashboard-accent">{order.id}</span>
          </td>
          <td className="dashboard-table-cell">
            <div>
              <div className="font-medium text-dashboard-text">
                {order.buyer}
              </div>
              <div className="text-xs text-dashboard-muted">
                {order.buyerType}
              </div>
            </div>
          </td>
          <td className="dashboard-table-cell">
            <span className="text-dashboard-text">{order.supplier}</span>
          </td>
          <td className="dashboard-table-cell">
            <div>
              <div className="text-dashboard-text">{order.part}</div>
              <div className="text-sm text-dashboard-muted">
                Qty: {order.quantity}
              </div>
            </div>
          </td>
          <td className="dashboard-table-cell">
            <span className="font-medium text-dashboard-text">{order.amount}</span>
          </td>
          <td className="dashboard-table-cell text-dashboard-muted">
            {order.orderDate}
          </td>
          <td className="dashboard-table-cell text-dashboard-muted">
            {order.deliveryDate}
          </td>
          <td className="dashboard-table-cell">
            <StatusBadge label={order.status} tone={ORDER_STATUS_TONES[order.status]} />
          </td>
          <td className="dashboard-table-cell">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-dashboard-panel-border px-4 py-1.5 text-dashboard-text hover:bg-dashboard-accent hover:text-white"
            >
              Details
            </Button>
          </td>
        </tr>
      ))}
    </SectionTable>
  )
}
