"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BellRing,
  CheckCheck,
  Clock,
  PackageCheck,
  ReceiptText,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  notificationFetch,
  notificationHref,
  notificationReadPath,
  notificationsApiPath,
  notificationsReadAllPath,
  notificationsStreamPath,
  type DashboardNotification,
} from "@/lib/notifications/client"

type NotificationsPayload = {
  ok: boolean
  notifications?: DashboardNotification[]
  notification?: DashboardNotification
  unreadCount?: number
}

type NotificationPopupProps = {
  onUnreadChange?: (count: number) => void
}

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return "Now"
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return "Now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const iconForType = (type: string) => {
  if (type.includes("booking")) return BellRing
  if (type.includes("order")) return PackageCheck
  return ReceiptText
}

const sortNotifications = (items: DashboardNotification[]) =>
  [...items].sort(
    (current, next) =>
      new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime(),
  )

export function NotificationPopup({ onUnreadChange }: NotificationPopupProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  useEffect(() => {
    onUnreadChange?.(unreadCount)
  }, [onUnreadChange, unreadCount])

  const applyPayload = useCallback((payload: NotificationsPayload) => {
    if (!payload.ok) return
    if (payload.notifications) {
      setNotifications(sortNotifications(payload.notifications))
    }
    if (typeof payload.unreadCount === "number") {
      setUnreadCount(payload.unreadCount)
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await notificationFetch(notificationsApiPath)
      const payload = (await response.json()) as NotificationsPayload
      applyPayload(payload)
    } catch {
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [applyPayload])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadNotifications()
    }, 0)
    const source = new EventSource(notificationsStreamPath, {
      withCredentials: true,
    })
    source.addEventListener("snapshot", (event) => {
      applyPayload(JSON.parse(event.data) as NotificationsPayload)
      setIsLoading(false)
    })
    source.addEventListener("notification", (event) => {
      const payload = JSON.parse(event.data) as {
        notification?: DashboardNotification
      }
      if (!payload.notification) return
      setNotifications((current) =>
        sortNotifications([
          payload.notification!,
          ...current.filter((item) => item.id !== payload.notification!.id),
        ]).slice(0, 20),
      )
      setUnreadCount((current) => current + 1)
    })
    return () => {
      window.clearTimeout(initialLoad)
      source.close()
    }
  }, [applyPayload, loadNotifications])

  const markOneRead = useCallback(async (notification: DashboardNotification) => {
    if (notification.readAt) return notification
    const response = await notificationFetch(notificationReadPath(notification.id), {
      method: "PATCH",
    })
    const payload = (await response.json()) as NotificationsPayload
    return payload.notification ?? notification
  }, [])

  const openNotification = async (notification: DashboardNotification) => {
    setIsMutating(true)
    try {
      const updated = await markOneRead(notification)
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      if (!notification.readAt) {
        setUnreadCount((current) => Math.max(0, current - 1))
      }
      if (notification.linkUrl) {
        window.location.assign(notificationHref(notification.linkUrl))
      }
    } finally {
      setIsMutating(false)
    }
  }

  const markAllRead = async () => {
    if (!unreadCount) return
    setIsMutating(true)
    try {
      const response = await notificationFetch(notificationsReadAllPath, {
        method: "PATCH",
      })
      const payload = (await response.json()) as NotificationsPayload
      applyPayload(payload)
    } finally {
      setIsMutating(false)
    }
  }

  const unreadLabel = useMemo(
    () => `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`,
    [unreadCount],
  )

  return (
    <div className="w-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Notifications
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{unreadLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!unreadCount || isMutating}
          onClick={() => void markAllRead()}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all
        </Button>
      </div>
      <div className="max-h-[22rem] overflow-y-auto">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <BellRing className="mb-2 h-6 w-6 opacity-60" />
            <p className="text-sm font-medium">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = iconForType(notification.type)
            const isUnread = !notification.readAt
            return (
              <button
                type="button"
                key={notification.id}
                disabled={isMutating}
                onClick={() => void openNotification(notification)}
                className={`flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none ${
                  isUnread ? "bg-primary/5" : ""
                }`}
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
                      {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {notification.body}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>
      <div className="border-t border-border bg-brand-surface/70 p-3 text-center text-xs text-muted-foreground">
        Latest account activity
      </div>
    </div>
  )
}

export { NotificationPopup as Notification_popup }
