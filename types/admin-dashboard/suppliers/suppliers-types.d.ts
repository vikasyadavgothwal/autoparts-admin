import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type SupplierStatus = "Approved" | "Pending" | "Rejected"

export type SupplierKpi = {
  id: string
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: "primary" | "success" | "warning"
}

export type SupplierMetric = {
  message: string
}

export type SupplierTableColumn = {
  key: string
  label: string
  className?: string
}

export type SupplierRecord = {
  id: string
  name: string
  email: string
  phone: string
  products: number
  rating: string
  joined: string
  status: SupplierStatus
}
