"use client"

import { useCallback, useEffect } from "react"

import { registerFirebasePushNotifications } from "@/lib/notifications/firebase-push"
import {
  notificationFetch,
  notificationsApiPath,
  notificationsStreamPath,
} from "@/lib/notifications/client"

type NotificationsPayload = {
  ok?: boolean
  unreadCount?: number
}

export function NotificationLiveListener({
  onUnreadChange,
}: {
  onUnreadChange: (count: number) => void
}) {
  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationFetch(notificationsApiPath)
      const payload = (await response.json()) as NotificationsPayload
      if (payload.ok && typeof payload.unreadCount === "number") {
        onUnreadChange(payload.unreadCount)
      }
    } catch {}
  }, [onUnreadChange])

  useEffect(() => {
    void registerFirebasePushNotifications()
    void loadUnreadCount()

    const source = new EventSource(notificationsStreamPath, {
      withCredentials: true,
    })

    const applyPayload = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as NotificationsPayload
        if (typeof payload.unreadCount === "number") {
          onUnreadChange(payload.unreadCount)
        }
      } catch {}
    }

    source.addEventListener("snapshot", applyPayload)
    source.addEventListener("notification", applyPayload)

    return () => source.close()
  }, [loadUnreadCount, onUnreadChange])

  return null
}
