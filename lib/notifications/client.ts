"use client"

export type DashboardNotification = {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export const notificationsApiPath = "/api/v1/notifications"
export const notificationsStreamPath = "/api/v1/notifications/stream"
export const notificationsReadAllPath = "/api/v1/notifications/read-all"
export const notificationReadPath = (id: string) =>
  `/api/v1/notifications/${encodeURIComponent(id)}/read`
export const notificationHref = (path: string) => path
export const notificationFetch = (
  input: RequestInfo | URL,
  init: RequestInit = {},
) => fetch(input, { ...init, credentials: "include" })
