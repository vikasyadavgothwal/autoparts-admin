import type { DashboardNotification } from "@/types/notifications/notifications"

type NotificationListener = (notification: DashboardNotification) => void

const globalNotifications = globalThis as typeof globalThis & {
  __autoPartsNotificationSubscribers?: Map<string, Set<NotificationListener>>
}

const subscribers =
  globalNotifications.__autoPartsNotificationSubscribers ??
  new Map<string, Set<NotificationListener>>()

globalNotifications.__autoPartsNotificationSubscribers = subscribers

export function notificationChannel(input: {
  recipientUserId: string | null
  recipientAdminId: string | null
}) {
  if (input.recipientUserId) return `user:${input.recipientUserId}`
  if (input.recipientAdminId) return `admin:${input.recipientAdminId}`
  return ""
}

export function subscribeToNotifications(
  channel: string,
  listener: NotificationListener,
) {
  const listeners = subscribers.get(channel) ?? new Set<NotificationListener>()
  listeners.add(listener)
  subscribers.set(channel, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      subscribers.delete(channel)
    }
  }
}

export function publishNotification(
  channel: string,
  notification: DashboardNotification,
) {
  const listeners = subscribers.get(channel)
  if (!listeners) return

  for (const listener of listeners) {
    listener(notification)
  }
}
