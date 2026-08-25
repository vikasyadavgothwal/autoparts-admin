import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type UserRoleLabel =
  | "Buyer"
  | "Fleet Manager"
  | "Garage Owner"
  | "Supplier"

type UserStatus = "Active" | "Suspended"

export type UserKpiTone = "primary" | "info" | "success" | "warning" | "neutral" | "danger"

export type UsersKpi = {
  id: string
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: UserKpiTone
}

export type UsersPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UsersSummary = {
  totalAccounts: number
  buyers: number
  fleetManagers: number
  garageOwners: number
}

export type UsersTableColumn = {
  key: string
  label: string
  className?: string
}

export type UserRecord = {
  internalId: string
  id: string
  name: string
  email: string
  phone: string
  companyName: string
  address: string
  city: string
  state: string
  country: string
  roles: UserRoleLabel[]
  role: string
  orders: number
  rfqs: number
  joined: string
  lastLogin: string
  emailVerified: boolean
  status: UserStatus
}

export type UserActivity = {
  user: string
  action: string
  time: string
}
