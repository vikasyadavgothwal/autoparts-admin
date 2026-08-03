import type { DashboardNotification } from "@/types/notifications/notifications"
import { createClient, type RedisClientType } from "redis"

type NotificationListener = (notification: DashboardNotification) => void
type NotificationEnvelope = {
  channel: string
  notification: DashboardNotification
  originId: string
}

const globalNotifications = globalThis as typeof globalThis & {
  __autoPartsNotificationSubscribers?: Map<string, Set<NotificationListener>>
  __autoPartsNotificationInstanceId?: string
  __autoPartsNotificationRedis?: {
    publisher?: RedisClientType
    subscriber?: RedisClientType
    publisherReady?: Promise<RedisClientType | null>
    subscriberReady?: Promise<RedisClientType | null>
    subscribedChannels: Set<string>
  }
}

const subscribers =
  globalNotifications.__autoPartsNotificationSubscribers ??
  new Map<string, Set<NotificationListener>>()

globalNotifications.__autoPartsNotificationSubscribers = subscribers

const instanceId =
  globalNotifications.__autoPartsNotificationInstanceId ??
  `${process.pid}:${Math.random().toString(36).slice(2)}`

globalNotifications.__autoPartsNotificationInstanceId = instanceId

const redisState =
  globalNotifications.__autoPartsNotificationRedis ?? {
    subscribedChannels: new Set<string>(),
  }

globalNotifications.__autoPartsNotificationRedis = redisState

const redisUrl = () =>
  process.env.NOTIFICATION_REDIS_URL?.trim() || process.env.REDIS_URL?.trim()

const redisChannel = (channel: string) => `autoparts:notifications:${channel}`

const localPublish = (channel: string, notification: DashboardNotification) => {
  const listeners = subscribers.get(channel)
  if (!listeners) return

  for (const listener of listeners) {
    listener(notification)
  }
}

async function getRedisPublisher() {
  const url = redisUrl()
  if (!url) return null
  if (redisState.publisherReady) return redisState.publisherReady

  redisState.publisherReady = (async () => {
    try {
      const publisher = createClient({ url })
      publisher.on("error", (error) => {
        console.error("Notification Redis publisher error", error)
      })
      await publisher.connect()
      redisState.publisher = publisher as RedisClientType
      return redisState.publisher
    } catch (error) {
      console.error("Notification Redis publisher unavailable", error)
      redisState.publisherReady = undefined
      return null
    }
  })()

  return redisState.publisherReady
}

async function getRedisSubscriber() {
  const url = redisUrl()
  if (!url) return null
  if (redisState.subscriberReady) return redisState.subscriberReady

  redisState.subscriberReady = (async () => {
    try {
      const subscriber = createClient({ url })
      subscriber.on("error", (error) => {
        console.error("Notification Redis subscriber error", error)
      })
      await subscriber.connect()
      redisState.subscriber = subscriber as RedisClientType
      return redisState.subscriber
    } catch (error) {
      console.error("Notification Redis subscriber unavailable", error)
      redisState.subscriberReady = undefined
      return null
    }
  })()

  return redisState.subscriberReady
}

async function subscribeToRedisChannel(channel: string) {
  if (redisState.subscribedChannels.has(channel)) return

  const subscriber = await getRedisSubscriber()
  if (!subscriber) return

  try {
    await subscriber.subscribe(redisChannel(channel), (message) => {
      try {
        const envelope = JSON.parse(message) as NotificationEnvelope
        if (
          envelope.originId === instanceId ||
          envelope.channel !== channel ||
          !envelope.notification
        ) {
          return
        }
        localPublish(channel, envelope.notification)
      } catch (error) {
        console.error("Unable to process Redis notification event", error)
      }
    })
    redisState.subscribedChannels.add(channel)
  } catch (error) {
    console.error("Unable to subscribe to notification Redis channel", error)
  }
}

async function unsubscribeFromRedisChannel(channel: string) {
  if (!redisState.subscribedChannels.has(channel)) return

  const subscriber = redisState.subscriber
  if (!subscriber) return

  try {
    await subscriber.unsubscribe(redisChannel(channel))
    redisState.subscribedChannels.delete(channel)
  } catch (error) {
    console.error("Unable to unsubscribe from notification Redis channel", error)
  }
}

async function publishToRedis(
  channel: string,
  notification: DashboardNotification,
) {
  const publisher = await getRedisPublisher()
  if (!publisher) return

  try {
    const envelope: NotificationEnvelope = {
      channel,
      notification,
      originId: instanceId,
    }
    await publisher.publish(redisChannel(channel), JSON.stringify(envelope))
  } catch (error) {
    console.error("Unable to publish notification through Redis", error)
  }
}

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
  void subscribeToRedisChannel(channel)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      subscribers.delete(channel)
      void unsubscribeFromRedisChannel(channel)
    }
  }
}

export function publishNotification(
  channel: string,
  notification: DashboardNotification,
) {
  localPublish(channel, notification)
  void publishToRedis(channel, notification)
}
