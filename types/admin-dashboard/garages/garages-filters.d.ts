import type { ReactNode } from "react"

export type GaragesFiltersProps = {
  statusOptions: readonly string[]
  locationOptions: readonly string[]
  verificationOptions: readonly string[]
}

export type DashboardSelectProps = {
  placeholder: string
  children: ReactNode
}

export type OptionItemProps = {
  value: string
  label: string
}

export type NormalizeOption = (value: string) => string
