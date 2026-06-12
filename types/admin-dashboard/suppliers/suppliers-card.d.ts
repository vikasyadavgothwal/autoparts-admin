import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import type { SupplierKpi } from "@/types/admin-dashboard/suppliers/suppliers-types"

export type SuppliersCardProps = {
  title: string
  value: string
  icon: ComponentType<LucideProps>
  iconTone: SupplierKpi["iconTone"]
}
