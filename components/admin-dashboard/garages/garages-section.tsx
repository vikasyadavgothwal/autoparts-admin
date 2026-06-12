import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { GaragesSectionProps } from "@/types/admin-dashboard/dashboard-sections"

const ACTION_TONE_CLASS: Record<GaragesSectionProps["items"][number]["actionTone"], string> = {
  success: "text-dashboard-success hover:text-dashboard-success hover:bg-dashboard-success/10",
  info: "text-dashboard-info hover:text-dashboard-info hover:bg-dashboard-info/10",
  danger: "text-dashboard-danger hover:text-dashboard-danger hover:bg-dashboard-danger/10",
  warning: "text-dashboard-warning hover:text-dashboard-warning hover:bg-dashboard-warning/10",
  neutral: "text-dashboard-muted hover:text-dashboard-muted hover:bg-dashboard-muted/10",
}

export function GaragesActivity({ items }: GaragesSectionProps) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
      <CardContent className="space-y-6 p-6">
        <h3 className="mb-0 text-xl font-semibold text-dashboard-text">
          Recent Garage Activity
        </h3>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.title}-${item.time}`}
              className="dashboard-activity-row"
            >
              <div>
                <div className="font-medium text-dashboard-text">
                  {item.title}
                </div>
                <div className="text-sm text-dashboard-muted">{item.time}</div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className={`h-6 rounded-md px-2 ${ACTION_TONE_CLASS[item.actionTone]}`}
              >
                {item.action}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
