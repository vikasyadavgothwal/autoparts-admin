import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { UsersCardProps } from "@/types/admin-dashboard/users/users-card"

const CARD_ICON_WRAPPER: Record<UsersCardProps["iconTone"], string> = {
  primary: "border-dashboard-accent/20 bg-dashboard-accent/10 text-dashboard-accent",
  info: "border-dashboard-info/20 bg-dashboard-info/10 text-dashboard-info",
  success: "border-dashboard-success/20 bg-dashboard-success/10 text-dashboard-success",
  warning: "border-dashboard-warning/20 bg-dashboard-warning/10 text-dashboard-warning",
  danger: "border-dashboard-danger/20 bg-dashboard-danger/10 text-dashboard-danger",
  neutral: "border-dashboard-muted/20 bg-dashboard-muted/10 text-dashboard-muted",
}

export function UsersCard({ title, value, icon: Icon, iconTone }: UsersCardProps) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
      <CardContent className="space-y-3 p-6">
        <div className="mb-2 flex items-center gap-3">
          <span className={cn("rounded-lg p-2", CARD_ICON_WRAPPER[iconTone])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="text-sm text-dashboard-muted">{title}</div>
        </div>
        <div className="text-3xl font-bold text-dashboard-text">{value}</div>
      </CardContent>
    </Card>
  )
}
