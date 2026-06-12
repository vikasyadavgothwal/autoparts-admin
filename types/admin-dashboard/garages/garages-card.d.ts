import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import type { GarageKpiTone } from "@/types/admin-dashboard/garages/garages-types"

export type GaragesCardProps = {
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: GarageKpiTone
}
