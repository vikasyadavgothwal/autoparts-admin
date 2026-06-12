import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import {
  ORDER_ALERTS,
  ORDER_BUYER_TYPE_FILTER_OPTIONS,
  ORDER_DISTRIBUTION,
  ORDER_DELIVERY_PERFORMANCE,
  ORDER_STATUS_FILTER_OPTIONS,
  ORDER_TABLE_COLUMNS,
  ORDERS,
  ORDERS_KPIS,
} from "@/services/admin-dashboard/orders/orders-data"
import { OrdersFilters } from "./orders-filters"
import { OrdersInsightCards } from "./orders-section"
import { OrdersStatCards } from "./orders-stat-cards"
import { OrdersTable } from "./orders-table"

export function OrdersPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Order Management"
        subtitle="Monitor all transactions across the platform."
      />

      <OrdersStatCards items={ORDERS_KPIS} />

      <OrdersFilters
        statusOptions={ORDER_STATUS_FILTER_OPTIONS}
        buyerTypeOptions={ORDER_BUYER_TYPE_FILTER_OPTIONS}
      />

      <OrdersTable rows={ORDERS} columns={ORDER_TABLE_COLUMNS} />

      <OrdersInsightCards
        distribution={ORDER_DISTRIBUTION}
        deliveryMetrics={ORDER_DELIVERY_PERFORMANCE}
        alerts={ORDER_ALERTS}
      />
    </div>
  )
}
