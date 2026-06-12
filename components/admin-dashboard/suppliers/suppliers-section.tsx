import { Card, CardContent } from "@/components/ui/card"
import type { SuppliersSectionProps } from "@/types/admin-dashboard/dashboard-sections"

export function SuppliersSection({ items }: SuppliersSectionProps) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
      <CardContent className="space-y-6 p-6">
        {items.map((item) => (
          <p key={item.message} className="text-sm text-dashboard-text">
            {item.message}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
