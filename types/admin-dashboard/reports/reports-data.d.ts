import type { ComponentType } from "react"

export type ReportIcon = ComponentType<{
  className?: string
  [key: string]: unknown
}>

export type ValueClass = string

export type Metric = {
  title: string
  value: string
  icon: ReportIcon
  iconClass: string
  note?: string
  subText?: string
  subNote?: string
  subClass?: ValueClass
}

export type GrowthPoint = {
  month: string
  users: number
  orders: number
  revenue: number
}

export type DistributionEntry = {
  name: string
  value: number
  color: string
}

export type RevenueCategory = {
  name: string
  revenue: number
}

export type MiniRow = readonly [string, string, string?]

export type MiniCard = {
  icon: ReportIcon
  iconClass: string
  title: string
  rows: readonly MiniRow[]
}

export type ReportAction = {
  title: string
  description: string
}
