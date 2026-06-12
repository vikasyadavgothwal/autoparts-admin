import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type {
  DashboardActivityListProps,
} from "@/types/dashboard-section"

export function DashboardActivityList({
  title,
  items,
}: DashboardActivityListProps) {
  return (
    <Card className="dashboard-activity-card">
      <div className="dashboard-activity-list">
        <h3 className="dashboard-section-subtitle">{title}</h3>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.title}-${item.description}`} className="dashboard-activity-row">
              <div>
                <div className="font-medium text-dashboard-text">{item.title}</div>
                <div className="text-sm text-dashboard-muted">{item.description}</div>
              </div>
              {item.actionText ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={item.actionClassName ?? "dashboard-ghost-action"}
                >
                  {item.actionText}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
