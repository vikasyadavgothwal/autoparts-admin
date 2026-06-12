import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

type DashboardStatIcon = ComponentType<LucideProps>

export type DashboardStat = {
  title: string
  value: string
  note: string
  icon: DashboardStatIcon
  red?: boolean
}

export type SupplierRecord = {
  id: string
  business: string
  email: string
  location: string
  submitted: string
}

export type RFQRecord = {
  id: string
  buyer: string
  part: string
  vehicle: string
  quotes: string
  status: "Active"
}

export type OrderRecord = {
  id: string
  buyer: string
  supplier: string
  amount: string
  status: "Completed" | "In Transit"
  date: string
}

export type HealthMetric = {
  title: string
  value: string
  note: string
  red?: boolean
}
