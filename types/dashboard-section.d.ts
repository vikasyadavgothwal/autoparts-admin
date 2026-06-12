export type SectionStat = {
  label: string
  value: string
  note: string
}

export type SectionUpdate = {
  title: string
  detail: string
}

export type DashboardSectionProps = {
  badge: string
  title: string
  description: string
  stats: readonly SectionStat[]
  updates: readonly SectionUpdate[]
}

export type DashboardActivityItem = {
  title: string
  description: string
  actionText?: string
  actionClassName?: string
}

export type DashboardActivityListProps = {
  title: string
  items: readonly DashboardActivityItem[]
}
