import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type GarageStatus = "Active" | "Pending" | "Suspended"
export type GarageKpiTone =
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"

export type GarageKpi = {
  id: string
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: GarageKpiTone
}

export type GarageTableColumn = {
  key: string
  label: string
  className?: string
}

export type GarageRecord = {
  id: string
  name: string
  owner: string
  location: string
  rating: string
  bookings: number
  revenue: string
  joinDate: string
  status: GarageStatus
  verified: boolean
}

export type GarageActivity = {
  title: string
  time: string
  action: string
  actionTone: "success" | "danger" | "info" | "warning" | "neutral"
}
