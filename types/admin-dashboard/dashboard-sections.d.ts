import type { ReactNode } from "react"
import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

import type { UserActivity } from "@/types/admin-dashboard/users/users-types"
import type { GarageActivity } from "@/types/admin-dashboard/garages/garages-types"
import type { SupplierMetric } from "@/types/admin-dashboard/suppliers/suppliers-types"
import type {
  DeliveryPerformanceItem,
  OrderAlert,
  OrderDistributionItem,
  OrderKpiTone,
} from "@/types/admin-dashboard/orders/orders-types"

export type UsersSectionProps = {
  items: readonly UserActivity[]
}

export type GaragesSectionProps = {
  items: readonly GarageActivity[]
}

export type SuppliersSectionProps = {
  items: readonly SupplierMetric[]
}

export type OrdersInsightCardsProps = {
  distribution: readonly OrderDistributionItem[]
  deliveryMetrics: readonly DeliveryPerformanceItem[]
  alerts: readonly OrderAlert[]
}

export type OrdersInfoCardProps = {
  icon: ComponentType<LucideProps>
  iconTone: OrderKpiTone
  title: string
  children: ReactNode
}

export type InfoRowProps = {
  label: string
  value: string
  valueClassName?: string
}
