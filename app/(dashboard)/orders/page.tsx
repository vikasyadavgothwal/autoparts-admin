import {
  LiveOrdersPage,
  type LiveOrder,
  type OrderPagination,
  type OrderSummary,
} from "@/components/admin-dashboard/orders/live-orders-page"
import { listAllOrders } from "@/services/orders/order-service"

export const dynamic = "force-dynamic"

const toClientOrders = (orders: LiveOrder[]): LiveOrder[] =>
  orders.map((order) => ({
    ...order,
    createdAt: new Date(order.createdAt).toISOString(),
    buyer: {
      ...order.buyer,
    },
    supplier: {
      ...order.supplier,
    },
    items: order.items.map((item) => ({
      ...item,
    })),
    rfq: order.rfq
      ? {
          ...order.rfq,
        }
      : null,
  }))

export default async function AdminOrdersPage() {
  const result = await listAllOrders(1, 10, "")
  const orders = toClientOrders(result.orders as unknown as LiveOrder[])
  return (
    <LiveOrdersPage
      initialOrders={orders}
      initialPagination={result.pagination as OrderPagination}
      initialSummary={result.summary as OrderSummary}
    />
  )
}
