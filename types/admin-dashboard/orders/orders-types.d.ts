import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled"

export type OrderKpiTone =
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"

export type OrdersKpi = {
  id: string
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: OrderKpiTone
}

export type OrdersTableColumn = {
  key: string
  label: string
  className?: string
}

export type OrdersFilterOption = {
  value: string
  label: string
}

export type OrderRecord = {
  id: string
  buyer: string
  buyerType: "Fleet" | "Individual" | "Garage"
  supplier: string
  part: string
  quantity: number
  amount: string
  orderDate: string
  deliveryDate: string
  status: OrderStatus
}

export type OrderDistributionItem = {
  label: string
  value: string
}

export type DeliveryPerformanceItem = {
  label: string
  value: string
  tone?: "success" | "warning" | "danger" | "neutral" | "info"
}

export type OrderAlert = {
  message: string
  tone: "success" | "warning" | "danger" | "info" | "neutral"
}
