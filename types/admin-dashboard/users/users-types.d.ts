import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

type UserRole = "Buyer" | "Fleet Manager" | "Garage Owner"

type UserStatus = "Active" | "Suspended"

export type UserKpiTone = "primary" | "info" | "success" | "warning" | "neutral" | "danger"

export type UsersKpi = {
  id: string
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: UserKpiTone
}

export type UsersTableColumn = {
  key: string
  label: string
  className?: string
}

export type UserRecord = {
  id: string
  name: string
  email: string
  role: UserRole
  orders: number
  rfqs: number
  joined: string
  status: UserStatus
}

export type UserActivity = {
  user: string
  action: string
  time: string
}
