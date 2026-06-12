import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import type { OrderKpiTone } from "@/types/admin-dashboard/orders/orders-types"

export type OrdersCardProps = {
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: OrderKpiTone
}
