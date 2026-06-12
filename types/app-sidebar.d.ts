import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"

export type AppSidebarNavItem = {
  title: string
  url: string
  icon: ComponentType<LucideProps>
}
