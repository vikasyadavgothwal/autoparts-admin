export type SupplierAnalytics = {
  generatedAt: string
  overview: {
    todayRevenue: number
    monthlyRevenue: number
    previousMonthRevenue: number
    rfqConversionRate: number
    pendingRfqs: number
    productsListed: number
    lowStockProducts: number
    activeOrders: number
  }
  performance: {
    totalOrders: number
    fulfilledOrders: number
    cancelledOrders: number
    fulfillmentRate: number
    cancellationRate: number
    repeatCustomerRate: number
    averageOrderValue: number
    averageQuoteResponseHours: number | null
  }
  offerCounts: Record<string, number>
  orderCounts: Record<string, number>
  revenueTrend: Array<{ date: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; unitsSold: number; revenue: number }>
  recentOrders: Array<{
    id: string
    publicId: string
    customer: string
    part: string
    quantity: number
    totalAmount: number
    status: string
  }>
  recentRfqs: Array<{
    id: string
    publicId: string
    vehicle: string
    part: string
    quantity: number
    responseDeadline: string
    quoted: boolean
  }>
}
