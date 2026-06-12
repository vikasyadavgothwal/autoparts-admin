import type { ReactNode } from "react"

export type SectionTableColumn = {
  key: string
  label: string
  className?: string
}

export type SectionTableProps = {
  columns: readonly SectionTableColumn[]
  children: ReactNode
}
