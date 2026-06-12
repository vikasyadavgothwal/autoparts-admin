import { CircleAlert, Clock, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type {
  DeliveryPerformanceItem,
  OrderAlert,
} from "@/types/admin-dashboard/orders/orders-types"
import type {
  InfoRowProps,
  OrdersInfoCardProps,
  OrdersInsightCardsProps,
} from "@/types/admin-dashboard/dashboard-sections"

const ISSUE_CLASS_BY_TONE: Record<OrderAlert["tone"], string> = {
  success:
    "border-dashboard-success/25 bg-dashboard-success/10 text-dashboard-success",
  warning:
    "border-dashboard-warning/25 bg-dashboard-warning/10 text-dashboard-warning",
  danger:
    "border-dashboard-danger/25 bg-dashboard-danger/10 text-dashboard-danger",
  info: "border-dashboard-info/25 bg-dashboard-info/10 text-dashboard-info",
  neutral:
    "border-dashboard-muted/25 bg-dashboard-muted/10 text-dashboard-muted",
}

const METRIC_VALUE_TONE: Record<
  NonNullable<DeliveryPerformanceItem["tone"]>,
  string
> = {
  neutral: "text-dashboard-text",
  success: "text-dashboard-success",
  warning: "text-dashboard-warning",
  danger: "text-dashboard-danger",
  info: "text-dashboard-info",
}

export function OrdersInsightCards({
  distribution,
  deliveryMetrics,
  alerts,
}: OrdersInsightCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <OrdersInfoCard icon={Package} iconTone="info" title="Order Distribution">
        <div className="space-y-3">
          {distribution.map((item) => (
            <InfoRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </OrdersInfoCard>

      <OrdersInfoCard
        icon={Clock}
        iconTone="success"
        title="Delivery Performance"
      >
        <div className="space-y-3">
          {deliveryMetrics.map((item) => (
            <InfoRow
              key={item.label}
              label={item.label}
              value={item.value}
              valueClassName={METRIC_VALUE_TONE[item.tone ?? "neutral"]}
            />
          ))}
        </div>
      </OrdersInfoCard>

      <OrdersInfoCard
        icon={CircleAlert}
        iconTone="warning"
        title="Issues & Alerts"
      >
        <div className="space-y-3">
          {alerts.map((alert) => (
            <p
              key={alert.message}
              className={`rounded border p-2 text-sm ${ISSUE_CLASS_BY_TONE[alert.tone]}`}
            >
              {alert.message}
            </p>
          ))}
        </div>
      </OrdersInfoCard>
    </section>
  )
}

function OrdersInfoCard({
  icon: Icon,
  iconTone,
  title,
  children,
}: OrdersInfoCardProps) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-dashboard-accent/20 bg-dashboard-accent/10 p-2">
            <Icon
              className={`h-5 w-5 ${
                iconTone === "primary"
                  ? "text-dashboard-accent"
                  : iconTone === "success"
                    ? "text-dashboard-success"
                    : iconTone === "warning"
                      ? "text-dashboard-warning"
                      : iconTone === "danger"
                        ? "text-dashboard-danger"
                        : iconTone === "neutral"
                          ? "text-dashboard-muted"
                          : "text-dashboard-info"
              }`}
            />
          </span>
          <h3 className="font-semibold text-dashboard-text">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  valueClassName,
}: InfoRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dashboard-muted">{label}</span>
      <span className={valueClassName ?? "text-dashboard-text"}>{value}</span>
    </div>
  )
}
