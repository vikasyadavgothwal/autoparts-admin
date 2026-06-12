import type { ComponentType, ReactNode } from "react"
import type { LucideProps } from "lucide-react"
import type {
  PartCategory,
  RfqRecord,
  RfqStat,
  TrendMetric,
} from "@/types/admin-dashboard/rfqs/rfqs-data"

export type RfqIcon = ComponentType<LucideProps>

export type RfqStatCardsProps = {
  items: readonly RfqStat[]
}

export type RfqFilterBarProps = {
  statusOptions: readonly string[]
  fleetOptions: readonly string[]
  searchPlaceholder?: string
}

export type RfqsDarkSelectProps = {
  placeholder: string
  items: readonly string[]
}

export type RfqTableProps = {
  columns: readonly string[]
  rows: readonly RfqRecord[]
}

export type RfqInfoCardsProps = {
  trendItems: readonly TrendMetric[]
  categories: readonly PartCategory[]
}

export type InfoCardProps = {
  icon?: RfqIcon
  iconClass?: string
  title: string
  children: ReactNode
}

export type InfoRowProps = {
  label: string
  value: string
  valueClass?: string
}

export type RfqPageHeaderProps = {
  title: string
  subtitle: string
  action?: ReactNode
}
