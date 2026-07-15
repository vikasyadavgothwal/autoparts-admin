import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { SupplierKpi } from "@/types/admin-dashboard/suppliers/suppliers-types"
import type { SuppliersCardProps } from "@/types/admin-dashboard/suppliers/suppliers-card"

const SUPPLIER_ICON_STYLES: Record<SupplierKpi["iconTone"], string> = {
  primary: "border-dashboard-accent/20 bg-dashboard-accent/10 text-dashboard-accent",
  success: "border-dashboard-success/20 bg-dashboard-success/10 text-dashboard-success",
  warning: "border-dashboard-warning/20 bg-dashboard-warning/10 text-dashboard-warning",
}

export function SuppliersCard({ title, value, icon: Icon, iconTone }: SuppliersCardProps) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
      <CardContent className="space-y-3 p-6">
        <div className="mb-2 flex items-center gap-3">
          <span className={cn("rounded-lg border p-2", SUPPLIER_ICON_STYLES[iconTone])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="text-sm text-dashboard-muted">{title}</div>
        </div>
        <div className="text-3xl font-bold text-dashboard-text">{value}</div>
      </CardContent>
    </Card>
  )
}
