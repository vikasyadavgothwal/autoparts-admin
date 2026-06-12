import { BellRing, CheckCheck, Clock, PackageCheck, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NotificationPopupItem } from "@/types/notification-popup"

const notifications: readonly NotificationPopupItem[] = [
  {
    title: "RFQ response received",
    description: "A supplier replied to your brake pad request.",
    time: "2 min ago",
    icon: ReceiptText,
  },
  {
    title: "Order shipped",
    description: "Front suspension kit is on the way.",
    time: "1 hr ago",
    icon: PackageCheck,
  },
  {
    title: "Booking confirmed",
    description: "Inspection slot confirmed for tomorrow morning.",
    time: "Today",
    icon: BellRing,
  },
]
export function NotificationPopup() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Notifications
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark read
        </Button>
      </div>

      <div className="max-h-[22rem] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <BellRing className="mb-2 h-6 w-6 opacity-60" />
            <p className="text-sm font-medium">No new notifications</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = notification.icon

            return (
              <button
                type="button"
                key={notification.title}
                className="flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="truncate text-sm font-medium text-foreground">
                      {notification.title}
                    </span>

                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {notification.time}
                    </span>
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {notification.description}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>

      <div className="border-t border-border bg-brand-surface/70 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-center"
        >
          View all notifications
        </Button>
      </div>
    </div>
  )
}

export { NotificationPopup as Notification_popup }
