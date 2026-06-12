import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type RfqStatus = "Active" | "Awarded" | "Closed" | "Expired"
export type RfqStatIcon = ComponentType<LucideProps>

export type RfqRecord = {
  id: string
  fleet: string
  part: string
  quantity: number
  estimatedValue: string
  bids: number
  bestBid: string
  created: string
  deadline: string
  status: RfqStatus
}

export type RfqStat = {
  title: string
  value: string
  icon: RfqStatIcon
  color: string
}

export type TrendMetric = {
  label: string
  value: string
  valueClass?: string
}

export type PartCategory = {
  label: string
  value: string
}
