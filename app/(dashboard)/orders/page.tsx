import {
  LiveOrdersPage,
  type LiveOrder,
  type OrderPagination,
  type OrderSummary,
} from "@/components/admin-dashboard/orders/live-orders-page"
import { listAllOrders } from "@/services/orders/order-service"

export default async function FleetOrdersPage() {
  const result = await listAllOrders(1, 10, "")
  const orders = JSON.parse(JSON.stringify(result.orders)) as LiveOrder[]
  return <LiveOrdersPage
    initialOrders={orders}
    initialPagination={result.pagination as OrderPagination}
    initialSummary={result.summary as OrderSummary}
  />
}
