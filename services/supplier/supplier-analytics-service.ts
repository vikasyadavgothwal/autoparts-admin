import { db } from "@/lib/database/prisma"
import { OrderStatus, RfqBidStatus, RfqStatus, SupplierPartMappingStatus } from "@/lib/generated/prisma/client"
import type { SupplierAnalytics } from "@/types/supplier/analytics"

const money = (value: number | null | undefined) => (value ?? 0) / 100

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

const startOfUtcMonth = (date: Date, offset = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))

const customerName = (buyer: {
  companyName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}) =>
  buyer.companyName ||
  [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") ||
  buyer.email ||
  "Customer"

export async function getSupplierAnalytics(
  supplierId: string,
): Promise<SupplierAnalytics> {
  const now = new Date()
  const today = startOfUtcDay(now)
  const month = startOfUtcMonth(now)
  const previousMonth = startOfUtcMonth(now, -1)
  const trendStart = startOfUtcDay(new Date(now.getTime() - 29 * 86_400_000))
  const nonCancelled = { not: OrderStatus.cancelled }
  const activeStatuses = [
    OrderStatus.pending,
    OrderStatus.confirmed,
    OrderStatus.processing,
  ]

  const [
    orders,
    orderStatuses,
    offers,
    inventory,
    lowStock,
    pendingRfqs,
    recentRfqs,
    recentOrders,
    topProductRows,
    customerGroups,
  ] = await Promise.all([
    db.order.findMany({
      where: { supplierId, status: nonCancelled },
      select: { buyerId: true, totalAmount: true, status: true, createdAt: true },
    }),
    db.order.groupBy({
      by: ["status"],
      where: { supplierId },
      _count: { _all: true },
    }),
    db.rfqBid.findMany({
      where: { supplierId },
      select: { status: true, createdAt: true, rfq: { select: { createdAt: true } } },
    }),
    db.supplierPart.count({
      where: { supplierId, mappingStatus: SupplierPartMappingStatus.mapped },
    }),
    db.supplierPart.count({
      where: {
        supplierId,
        mappingStatus: SupplierPartMappingStatus.mapped,
        stock: { lte: 5 },
      },
    }),
    db.rfq.count({
      where: {
        status: RfqStatus.open,
        responseDeadline: { gt: now },
        bids: { none: { supplierId } },
      },
    }),
    db.rfq.findMany({
      where: { status: RfqStatus.open, responseDeadline: { gt: now } },
      select: {
        id: true,
        publicId: true,
        vehicleYear: true,
        vehicleMake: true,
        vehicleModel: true,
        vehicleTrim: true,
        responseDeadline: true,
        parts: { select: { partName: true, quantity: true }, orderBy: { createdAt: "asc" } },
        bids: { where: { supplierId }, select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.order.findMany({
      where: { supplierId },
      select: {
        id: true,
        publicId: true,
        totalAmount: true,
        status: true,
        buyer: { select: { companyName: true, firstName: true, lastName: true, email: true } },
        items: { select: { partName: true, quantity: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.orderItem.groupBy({
      by: ["partName"],
      where: { order: { supplierId, status: nonCancelled } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.order.groupBy({
      by: ["buyerId"],
      where: { supplierId, status: nonCancelled },
      _count: { _all: true },
    }),
  ])

  const orderCounts = Object.fromEntries(
    orderStatuses.map((row) => [row.status, row._count._all]),
  )
  const offerCounts = Object.fromEntries(
    Object.values(RfqBidStatus).map((status) => [
      status,
      offers.filter((offer) => offer.status === status).length,
    ]),
  )
  const totalOrders = Object.values(orderCounts).reduce((sum, count) => sum + count, 0)
  const fulfilledOrders = orderCounts[OrderStatus.delivered] ?? 0
  const cancelledOrders = orderCounts[OrderStatus.cancelled] ?? 0
  const acceptedOffers = offerCounts[RfqBidStatus.accepted] ?? 0
  const revenueOrders = orders.filter((order) => order.status !== OrderStatus.cancelled)
  const monthlyRevenue = revenueOrders
    .filter((order) => order.createdAt >= month)
    .reduce((sum, order) => sum + money(order.totalAmount), 0)
  const previousMonthRevenue = revenueOrders
    .filter((order) => order.createdAt >= previousMonth && order.createdAt < month)
    .reduce((sum, order) => sum + money(order.totalAmount), 0)
  const todayRevenue = revenueOrders
    .filter((order) => order.createdAt >= today)
    .reduce((sum, order) => sum + money(order.totalAmount), 0)
  const averageQuoteResponseHours = offers.length
    ? offers.reduce(
        (sum, offer) => sum + Math.max(0, offer.createdAt.getTime() - offer.rfq.createdAt.getTime()),
        0,
      ) / offers.length / 3_600_000
    : null

  const revenueByDate = new Map<string, { revenue: number; orders: number }>()
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(trendStart.getTime() + offset * 86_400_000)
    revenueByDate.set(date.toISOString().slice(0, 10), { revenue: 0, orders: 0 })
  }
  for (const order of revenueOrders.filter((item) => item.createdAt >= trendStart)) {
    const bucket = revenueByDate.get(order.createdAt.toISOString().slice(0, 10))
    if (bucket) {
      bucket.revenue += money(order.totalAmount)
      bucket.orders += 1
    }
  }

  return {
    generatedAt: now.toISOString(),
    overview: {
      todayRevenue,
      monthlyRevenue,
      previousMonthRevenue,
      rfqConversionRate: offers.length ? (acceptedOffers / offers.length) * 100 : 0,
      pendingRfqs,
      productsListed: inventory,
      lowStockProducts: lowStock,
      activeOrders: activeStatuses.reduce((sum, status) => sum + (orderCounts[status] ?? 0), 0),
    },
    performance: {
      totalOrders,
      fulfilledOrders,
      cancelledOrders,
      fulfillmentRate: totalOrders ? (fulfilledOrders / totalOrders) * 100 : 0,
      cancellationRate: totalOrders ? (cancelledOrders / totalOrders) * 100 : 0,
      repeatCustomerRate: customerGroups.length
        ? (customerGroups.filter((row) => row._count._all > 1).length / customerGroups.length) * 100
        : 0,
      averageOrderValue: revenueOrders.length
        ? orders.reduce((sum, order) => sum + money(order.totalAmount), 0) / revenueOrders.length
        : 0,
      averageQuoteResponseHours,
    },
    offerCounts,
    orderCounts,
    revenueTrend: Array.from(revenueByDate, ([date, value]) => ({ date, ...value })),
    topProducts: topProductRows.map((row) => ({
      name: row.partName,
      unitsSold: row._sum.quantity ?? 0,
      revenue: money(row._sum.lineTotal),
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      publicId: order.publicId,
      customer: customerName(order.buyer),
      part: order.items.length === 1 ? order.items[0]?.partName ?? "Part" : `${order.items.length} parts`,
      quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: money(order.totalAmount),
      status: order.status,
    })),
    recentRfqs: recentRfqs.map((rfq) => ({
      id: rfq.id,
      publicId: rfq.publicId,
      vehicle: [rfq.vehicleYear, rfq.vehicleMake, rfq.vehicleModel, rfq.vehicleTrim].filter(Boolean).join(" ") || "Not specified",
      part: rfq.parts.length === 1 ? rfq.parts[0]?.partName ?? "Part" : `${rfq.parts.length} parts`,
      quantity: rfq.parts.reduce((sum, part) => sum + part.quantity, 0),
      responseDeadline: rfq.responseDeadline.toISOString(),
      quoted: rfq.bids.length > 0,
    })),
  }
}
