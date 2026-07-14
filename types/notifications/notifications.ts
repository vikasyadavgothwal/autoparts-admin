export type NotificationScope =
  | { kind: "user"; id: string }
  | { kind: "admin"; id: string }

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

export type NotificationListResult = {
  notifications: DashboardNotification[]
  unreadCount: number
}
