import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type NotificationPopupItem = {
  title: string
  description: string
  time: string
  icon: ComponentType<LucideProps>
}
