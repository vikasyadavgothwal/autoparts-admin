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
  internalId: string
  id: string
  accountId: string
  name: string
  contactName: string
  email: string
  phone: string
  tradeLicenseNumber: string
  contactPerson: string
  designation: string
  tradeLicenseImageUrl: string | null
  vatTrnNumber: string
  vatTrnImageUrl: string | null
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  products: number
  rating: string
  joined: string
  lastLogin: string
  emailVerified: boolean
  accountActive: boolean
  reviewedAt: string
  reviewedBy: string
  status: SupplierStatus
}
