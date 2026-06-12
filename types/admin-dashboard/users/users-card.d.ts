import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import type { UserKpiTone } from "@/types/admin-dashboard/users/users-types"

export type UsersCardProps = {
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: UserKpiTone
}
