import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import type { GarageServiceReviewRecord } from "@/types/garage/reviews"

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
  internalId: string
  id: string
  accountId: string
  name: string
  owner: string
  email?: string
  phone?: string
  location: string
  address?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
  rating: string
  reviewsCount?: number
  reviews?: GarageServiceReviewRecord[]
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
